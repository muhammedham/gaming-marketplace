import {
  Prisma,
  type CatalogStatus,
  type ListingStatus,
  type OrderStatus,
  type UserRole,
  type UserStatus,
} from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { lockedOrder, orderOutput, settle } from "../orders/orders.service.js";
import { pageArgs, paged, type Actor, type Page } from "../orders/orders.shared.js";

export type AdminListQuery = Page & { q?: string };
type AuditClient = Prisma.TransactionClient | typeof prisma;

async function audit(client: AuditClient, adminId: string, action: string, entityType: string, entityId: string, details: Prisma.InputJsonObject = {}) {
  await client.adminAuditLog.create({ data: { adminId, action, entityType, entityId, details } });
}

function text(value: string, field: string, minimum = 1) {
  const normalized = value.trim();
  if (normalized.length < minimum) throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", { [field]: [`${field} must contain at least ${minimum} non-whitespace characters.`] });
  return normalized;
}

function slug(value: string) {
  return value.trim().toLocaleLowerCase("tr").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueError(error: unknown, resource: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, `${resource.toUpperCase()}_ALREADY_EXISTS`, `${resource} name or slug already exists.`);
  throw error;
}

const decimal = (value: Prisma.Decimal | null | undefined) => value?.toFixed(2) ?? "0.00";

export async function dashboard() {
  const [users, suspendedUsers, categories, games, activeListings, orders, orderGroups, openSupport, withdrawalSummary, walletSummary, recentOrders, recentLedger, recentAudits] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.category.count({ where: { status: "ACTIVE" } }),
    prisma.game.count({ where: { status: "ACTIVE" } }),
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.order.count(),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.supportTicket.count({ where: { status: { not: "Closed" } } }),
    prisma.withdrawal.aggregate({ _count: true, _sum: { amountCoin: true, netAmountTry: true } }),
    prisma.wallet.aggregate({ _sum: { availableBalance: true, heldBalance: true } }),
    prisma.order.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { buyer: { select: { id: true, name: true } }, seller: { select: { id: true, name: true } } } }),
    prisma.walletTransaction.findMany({ take: 8, orderBy: { ledgerSequence: "desc" }, include: { wallet: { include: { user: { select: { id: true, name: true, email: true } } } } } }),
    prisma.adminAuditLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { admin: { select: { id: true, name: true } } } }),
  ]);
  return {
    counts: { users, suspendedUsers, activeCategories: categories, activeGames: games, activeListings, orders, openSupport, simulatedWithdrawals: withdrawalSummary._count },
    balances: { availableCoin: decimal(walletSummary._sum.availableBalance), heldCoin: decimal(walletSummary._sum.heldBalance), simulatedWithdrawnCoin: decimal(withdrawalSummary._sum.amountCoin), simulatedNetTry: decimal(withdrawalSummary._sum.netAmountTry) },
    ordersByStatus: Object.fromEntries(orderGroups.map((item) => [item.status, item._count])),
    recentOrders: recentOrders.map(orderOutput),
    recentLedger: recentLedger.map((item) => ({ id: item.id, sequence: item.ledgerSequence, type: item.type, amount: item.amount.toFixed(2), orderId: item.orderId, description: item.description, createdAt: item.createdAt, user: item.wallet.user })),
    recentAudits,
  };
}

export async function listUsers(query: AdminListQuery & { role?: UserRole; status?: UserStatus }) {
  const { skip, take } = pageArgs(query);
  const q = query.q?.trim();
  const where: Prisma.UserWhereInput = { ...(query.role ? { role: query.role } : {}), ...(query.status ? { status: query.status } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}) };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, wallet: { select: { availableBalance: true, heldBalance: true } }, _count: { select: { listings: true, purchases: true, sales: true, tickets: true } } } }),
    prisma.user.count({ where }),
  ]);
  return paged(items.map((item) => ({ ...item, wallet: item.wallet ? { availableBalance: item.wallet.availableBalance.toFixed(2), heldBalance: item.wallet.heldBalance.toFixed(2) } : null })), total, query);
}

export async function updateUser(actor: Actor, id: string, input: { role?: UserRole; status?: UserStatus }) {
  if (id === actor.id && (input.role !== undefined || input.status === "SUSPENDED")) throw new AppError(409, "ADMIN_SELF_PROTECTION", "You cannot change your own role or suspend your own account.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    const removesActiveAdmin = current.role === "ADMIN" && current.status === "ACTIVE" && ((input.role !== undefined && input.role !== "ADMIN") || input.status === "SUSPENDED");
    if (removesActiveAdmin && await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }) <= 1) throw new AppError(409, "LAST_ADMIN", "The final active Admin cannot be removed or suspended.");
    const updated = await tx.user.update({ where: { id }, data: { ...(input.role ? { role: input.role } : {}), ...(input.status ? { status: input.status } : {}) }, select: { id: true, name: true, email: true, role: true, status: true, updatedAt: true } });
    await audit(tx, actor.id, "USER_UPDATED", "User", id, { beforeRole: current.role, afterRole: updated.role, beforeStatus: current.status, afterStatus: updated.status });
    return updated;
  });
}

export async function listCategories(query: AdminListQuery & { status?: CatalogStatus }) {
  const { skip, take } = pageArgs(query);
  const where: Prisma.CategoryWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.q?.trim() ? { OR: [{ name: { contains: query.q.trim(), mode: "insensitive" } }, { slug: { contains: query.q.trim(), mode: "insensitive" } }] } : {}) };
  const [items, total] = await Promise.all([prisma.category.findMany({ where, skip, take, orderBy: { name: "asc" }, include: { _count: { select: { listings: true } } } }), prisma.category.count({ where })]);
  return paged(items, total, query);
}

export async function createCategory(actor: Actor, input: { name: string; slug?: string; description: string }) {
  const name = text(input.name, "name", 2), normalizedSlug = slug(input.slug || name);
  if (!normalizedSlug) throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", { slug: ["Enter a valid slug."] });
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.category.create({ data: { name, slug: normalizedSlug, description: text(input.description, "description", 3) } });
      await audit(tx, actor.id, "CATEGORY_CREATED", "Category", item.id, { name: item.name, slug: item.slug });
      return item;
    });
  } catch (error) { uniqueError(error, "category"); }
}

export async function updateCategory(actor: Actor, id: string, input: { name?: string; slug?: string; description?: string; status?: CatalogStatus }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.category.findUnique({ where: { id } });
      if (!current) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
      const updated = await tx.category.update({ where: { id }, data: { ...(input.name !== undefined ? { name: text(input.name, "name", 2) } : {}), ...(input.slug !== undefined ? { slug: slug(input.slug) } : {}), ...(input.description !== undefined ? { description: text(input.description, "description", 3) } : {}), ...(input.status ? { status: input.status } : {}) } });
      let hiddenListings = 0;
      if (current.status === "ACTIVE" && updated.status === "INACTIVE") hiddenListings = (await tx.listing.updateMany({ where: { categoryId: id, status: "ACTIVE" }, data: { status: "INACTIVE" } })).count;
      await audit(tx, actor.id, "CATEGORY_UPDATED", "Category", id, { status: updated.status, hiddenListings });
      return { ...updated, hiddenListings };
    });
  } catch (error) { uniqueError(error, "category"); }
}

export async function listGames(query: AdminListQuery & { status?: CatalogStatus }) {
  const { skip, take } = pageArgs(query);
  const where: Prisma.GameWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.q?.trim() ? { OR: [{ name: { contains: query.q.trim(), mode: "insensitive" } }, { slug: { contains: query.q.trim(), mode: "insensitive" } }] } : {}) };
  const [items, total] = await Promise.all([prisma.game.findMany({ where, skip, take, orderBy: { name: "asc" }, include: { _count: { select: { listings: true } } } }), prisma.game.count({ where })]);
  return paged(items, total, query);
}

export async function createGame(actor: Actor, input: { name: string; slug?: string }) {
  const name = text(input.name, "name", 2), normalizedSlug = slug(input.slug || name);
  if (!normalizedSlug) throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", { slug: ["Enter a valid slug."] });
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.game.create({ data: { name, slug: normalizedSlug } });
      await audit(tx, actor.id, "GAME_CREATED", "Game", item.id, { name: item.name, slug: item.slug });
      return item;
    });
  } catch (error) { uniqueError(error, "game"); }
}

export async function updateGame(actor: Actor, id: string, input: { name?: string; slug?: string; status?: CatalogStatus }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.game.findUnique({ where: { id } });
      if (!current) throw new AppError(404, "GAME_NOT_FOUND", "Game not found.");
      const updated = await tx.game.update({ where: { id }, data: { ...(input.name !== undefined ? { name: text(input.name, "name", 2) } : {}), ...(input.slug !== undefined ? { slug: slug(input.slug) } : {}), ...(input.status ? { status: input.status } : {}) } });
      let hiddenListings = 0;
      if (current.status === "ACTIVE" && updated.status === "INACTIVE") hiddenListings = (await tx.listing.updateMany({ where: { gameId: id, status: "ACTIVE" }, data: { status: "INACTIVE" } })).count;
      await audit(tx, actor.id, "GAME_UPDATED", "Game", id, { status: updated.status, hiddenListings });
      return { ...updated, hiddenListings };
    });
  } catch (error) { uniqueError(error, "game"); }
}

export async function listListings(query: AdminListQuery & { status?: ListingStatus }) {
  const { skip, take } = pageArgs(query), q = query.q?.trim();
  const where: Prisma.ListingWhereInput = { ...(query.status ? { status: query.status } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { seller: { name: { contains: q, mode: "insensitive" } } }] } : {}) };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { seller: { select: { id: true, name: true, email: true } }, category: { select: { id: true, name: true, status: true } }, game: { select: { id: true, name: true, status: true } }, _count: { select: { media: true, orders: true } } } }),
    prisma.listing.count({ where }),
  ]);
  return paged(items.map((item) => ({ ...item, price: item.price.toFixed(2) })), total, query);
}

export async function updateListingStatus(actor: Actor, id: string, status: ListingStatus) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.listing.findUnique({ where: { id }, include: { category: true, game: true } });
    if (!current) throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found.");
    if (status === "ACTIVE" && (current.category.status !== "ACTIVE" || current.game?.status === "INACTIVE")) throw new AppError(409, "TAXONOMY_INACTIVE", "Activate the listing category and game first.");
    const updated = await tx.listing.update({ where: { id }, data: { status } });
    await audit(tx, actor.id, "LISTING_STATUS_UPDATED", "Listing", id, { before: current.status, after: updated.status });
    return { ...updated, price: updated.price.toFixed(2) };
  });
}

export async function listOrders(query: AdminListQuery & { status?: OrderStatus }) {
  const { skip, take } = pageArgs(query), q = query.q?.trim();
  const where: Prisma.OrderWhereInput = { ...(query.status ? { status: query.status } : {}), ...(q ? { OR: [{ listingTitle: { contains: q, mode: "insensitive" } }, { buyer: { name: { contains: q, mode: "insensitive" } } }, { seller: { name: { contains: q, mode: "insensitive" } } }] } : {}) };
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { buyer: { select: { id: true, name: true, email: true } }, seller: { select: { id: true, name: true, email: true } }, tickets: { select: { id: true, status: true } }, review: { select: { id: true, rating: true } } } }),
    prisma.order.count({ where }),
  ]);
  return paged(items.map(orderOutput), total, query);
}

export async function resolveOrder(actor: Actor, id: string, input: { action: "Complete" | "Cancel"; note: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await lockedOrder(tx, id);
    if (order.status === "SupportPaused") throw new AppError(409, "SUPPORT_RESOLUTION_REQUIRED", "Resolve this order from its support ticket.");
    if (input.action === "Complete" && order.status !== "WaitingConfirmation") throw new AppError(409, "INVALID_ORDER_STATE", "Only an order waiting for confirmation can be completed by Admin.");
    if (input.action === "Cancel" && !["WaitingDelivery", "WaitingConfirmation"].includes(order.status)) throw new AppError(409, "INVALID_ORDER_STATE", "This order cannot be cancelled by Admin now.");
    const result = await settle(tx, order, actor, input.action === "Cancel");
    await audit(tx, actor.id, `ORDER_${input.action.toUpperCase()}`, "Order", id, { note: text(input.note, "note", 3) });
    return result;
  }, { timeout: 15000 });
}

export async function listWithdrawals(query: AdminListQuery) {
  const { skip, take } = pageArgs(query), q = query.q?.trim();
  const where: Prisma.WithdrawalWhereInput = q ? { OR: [{ accountHolderName: { contains: q, mode: "insensitive" } }, { wallet: { user: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } }] } : {};
  const [items, total] = await Promise.all([
    prisma.withdrawal.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { wallet: { include: { user: { select: { id: true, name: true, email: true } } } } } }),
    prisma.withdrawal.count({ where }),
  ]);
  return paged(items.map((item) => ({ ...item, amountCoin: item.amountCoin.toFixed(2), coinTryRate: item.coinTryRate.toFixed(6), feeRate: item.feeRate.toFixed(6), feeCoin: item.feeCoin.toFixed(2), netAmountTry: item.netAmountTry.toFixed(2), simulation: true })), total, query);
}

export async function listSupport(query: AdminListQuery & { status?: "Open" | "InProgress" | "Answered" | "Closed" }) {
  const { skip, take } = pageArgs(query), q = query.q?.trim();
  const where: Prisma.SupportTicketWhereInput = { ...(query.status ? { status: query.status } : {}), ...(q ? { OR: [{ subject: { contains: q, mode: "insensitive" } }, { user: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } }] } : {}) };
  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({ where, skip, take, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include: { user: { select: { id: true, name: true, email: true } }, order: { select: { id: true, listingTitle: true, status: true } }, _count: { select: { messages: true } } } }),
    prisma.supportTicket.count({ where }),
  ]);
  return paged(items, total, query);
}

export async function getSettings() {
  const value = await prisma.systemSettings.findUnique({ where: { id: 1 } });
  if (!value) throw new AppError(500, "SETTINGS_NOT_FOUND", "System settings are missing. Run the seed command.");
  return { coinTryRate: value.coinTryRate.toFixed(6), withdrawalFeeRate: value.withdrawalFeeRate.toFixed(6), autoConfirmationHours: value.autoConfirmationHours.toFixed(4), updatedAt: value.updatedAt };
}

export async function updateSettings(actor: Actor, input: { coinTryRate: string; withdrawalFeeRate: string; autoConfirmationHours: string }) {
  const coinTryRate = new Prisma.Decimal(input.coinTryRate), withdrawalFeeRate = new Prisma.Decimal(input.withdrawalFeeRate), autoConfirmationHours = new Prisma.Decimal(input.autoConfirmationHours);
  if (coinTryRate.lessThanOrEqualTo(0) || withdrawalFeeRate.isNegative() || withdrawalFeeRate.greaterThan(1) || autoConfirmationHours.lessThan("0.001") || autoConfirmationHours.greaterThan(168)) throw new AppError(400, "INVALID_SETTINGS", "Settings are outside the allowed range.", { coinTryRate: ["Rate must be greater than zero."], withdrawalFeeRate: ["Fee rate must be between 0 and 1."], autoConfirmationHours: ["Confirmation time must be between 0.001 and 168 hours."] });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.systemSettings.upsert({ where: { id: 1 }, update: { coinTryRate, withdrawalFeeRate, autoConfirmationHours }, create: { id: 1, coinTryRate, withdrawalFeeRate, autoConfirmationHours } });
    await audit(tx, actor.id, "SETTINGS_UPDATED", "SystemSettings", "1", { coinTryRate: coinTryRate.toString(), withdrawalFeeRate: withdrawalFeeRate.toString(), autoConfirmationHours: autoConfirmationHours.toString() });
    return { coinTryRate: updated.coinTryRate.toFixed(6), withdrawalFeeRate: updated.withdrawalFeeRate.toFixed(6), autoConfirmationHours: updated.autoConfirmationHours.toFixed(4), updatedAt: updated.updatedAt };
  });
}

export async function listAudits(query: AdminListQuery) {
  const { skip, take } = pageArgs(query);
  const where: Prisma.AdminAuditLogWhereInput = query.q?.trim() ? { OR: [{ action: { contains: query.q.trim(), mode: "insensitive" } }, { entityType: { contains: query.q.trim(), mode: "insensitive" } }, { entityId: { contains: query.q.trim(), mode: "insensitive" } }] } : {};
  const [items, total] = await Promise.all([prisma.adminAuditLog.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { admin: { select: { id: true, name: true, email: true } } } }), prisma.adminAuditLog.count({ where })]);
  return paged(items, total, query);
}
