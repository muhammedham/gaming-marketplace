import {
  Prisma,
  type Order,
  type OrderStatus,
  type WalletTransactionType,
} from "@prisma/client";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { assertLedgerConsistency } from "../wallet/wallet.service.js";
import {
  notify,
  pageArgs,
  paged,
  publicUser,
  requireAccess,
  textValue,
  type Actor,
  type Page,
} from "./orders.shared.js";

const orderInclude = {
  buyer: { select: publicUser },
  seller: { select: publicUser },
  conversation: { select: { id: true } },
  review: true,
} satisfies Prisma.OrderInclude;
export function orderOutput<T extends { price: Prisma.Decimal }>(order: T) {
  return { ...order, price: order.price.toFixed(2) };
}

export async function lockedOrder(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  return order;
}
export function participant(order: Order, actor: Actor) {
  requireAccess(
    actor.role === "ADMIN" ||
      order.buyerId === actor.id ||
      order.sellerId === actor.id,
  );
}
export async function event(
  tx: Prisma.TransactionClient,
  orderId: string,
  status: OrderStatus,
  actor: Actor | null,
  note: string,
) {
  await tx.orderEvent.create({
    data: {
      orderId,
      status,
      actorId: actor?.id,
      actorRole: actor?.role ?? "SYSTEM",
      note,
    },
  });
}
async function lockWallets(tx: Prisma.TransactionClient, userIds: string[]) {
  // Stable lock ordering prevents two simultaneous settlements from deadlocking.
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM wallets WHERE user_id IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
}
async function ledger(
  tx: Prisma.TransactionClient,
  userId: string,
  order: Order,
  type: WalletTransactionType,
  available: number,
  held: number,
) {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  await assertLedgerConsistency(
    wallet.id,
    wallet.availableBalance,
    wallet.heldBalance,
    tx,
  );
  const availableAfter = wallet.availableBalance.add(
    order.price.mul(available),
  );
  const heldAfter = wallet.heldBalance.add(order.price.mul(held));
  if (availableAfter.isNegative() || heldAfter.isNegative())
    throw new AppError(
      409,
      "INSUFFICIENT_FUNDS",
      "Available balance is not sufficient, or held funds are inconsistent.",
    );
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      orderId: order.id,
      type,
      amount: order.price,
      idempotencyKey: `order-${order.id}-${type}`,
      description: `${type}: ${order.listingTitle}`.slice(0, 255),
      availableBefore: wallet.availableBalance,
      availableAfter,
      heldBefore: wallet.heldBalance,
      heldAfter,
    },
  });
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { availableBalance: availableAfter, heldBalance: heldAfter },
  });
}

export async function purchase(
  actor: Actor,
  input: { listingId: string; expectedPrice: string; idempotencyKey: string },
) {
  requireAccess(actor.role === "BUYER");
  return prisma.$transaction(
    async (tx) => {
      await lockWallets(tx, [actor.id]);
      const previous = await tx.order.findUnique({
        where: {
          buyerId_idempotencyKey: {
            buyerId: actor.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: orderInclude,
      });
      if (previous) {
        if (
          previous.listingId !== input.listingId ||
          !previous.price.equals(input.expectedPrice)
        )
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Use a new key for a different purchase.",
          );
        return orderOutput(previous);
      }
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${input.listingId}::uuid FOR SHARE`;
      const listing = await tx.listing.findUnique({
        where: { id: input.listingId },
      });
      if (!listing || listing.status !== "ACTIVE")
        throw new AppError(
          409,
          "LISTING_UNAVAILABLE",
          "This listing is no longer available.",
        );
      requireAccess(listing.sellerId !== actor.id);
      if (!listing.price.equals(input.expectedPrice))
        throw new AppError(
          409,
          "PRICE_CHANGED",
          "The listing price changed. Refresh before buying.",
        );
      const order = await tx.order.create({
        data: {
          buyerId: actor.id,
          sellerId: listing.sellerId,
          listingId: listing.id,
          listingTitle: listing.title,
          price: listing.price,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await event(
        tx,
        order.id,
        "Created",
        actor,
        "Order created; price and title captured.",
      );
      await ledger(tx, actor.id, order, "HOLD", -1, 1);
      await event(
        tx,
        order.id,
        "Paid",
        actor,
        "Buyer funds moved from Available to Held.",
      );
      await event(
        tx,
        order.id,
        "WaitingDelivery",
        actor,
        "Waiting for seller delivery.",
      );
      await tx.conversation.create({
        data: {
          contextKey: `order-${order.id}`,
          buyerId: actor.id,
          sellerId: listing.sellerId,
          listingId: listing.id,
          orderId: order.id,
        },
      });
      await notify(
        tx,
        [actor.id, listing.sellerId],
        "ORDER",
        "New order",
        `${listing.title}: ${listing.price.toFixed(2)} Coin held until completion.`,
        `/orders/${order.id}`,
      );
      return orderOutput(
        await tx.order.update({
          where: { id: order.id },
          data: { status: "WaitingDelivery" },
          include: orderInclude,
        }),
      );
    },
    { timeout: 15000 },
  );
}

export async function getOrder(actor: Actor, id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      ...orderInclude,
      events: { orderBy: { id: "asc" } },
      tickets: {
        where: actor.role === "ADMIN" ? {} : { userId: actor.id },
        select: { id: true, subject: true, status: true },
      },
    },
  });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  participant(order, actor);
  return { ...orderOutput(order), serverTime: new Date().toISOString() };
}
export async function listOrders(actor: Actor, query: Page) {
  const where: Prisma.OrderWhereInput =
    actor.role === "ADMIN"
      ? {}
      : { OR: [{ buyerId: actor.id }, { sellerId: actor.id }] };
  const { skip, take } = pageArgs(query);
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: orderInclude,
    }),
    prisma.order.count({ where }),
  ]);
  return paged(items.map(orderOutput), total, query);
}
export async function deliver(actor: Actor, id: string, note: string) {
  return prisma.$transaction(async (tx) => {
    const order = await lockedOrder(tx, id);
    requireAccess(actor.role === "SELLER" && order.sellerId === actor.id);
    if (["WaitingConfirmation", "Completed"].includes(order.status))
      return orderOutput(order);
    if (order.status !== "WaitingDelivery")
      throw new AppError(
        409,
        "INVALID_ORDER_STATE",
        "Only an order waiting for delivery can be delivered.",
      );
    const deliveryNote = textValue(note, "deliveryNote");
    const settings = await tx.systemSettings.findUnique({ where: { id: 1 } });
    const confirmationHours = settings
      ? settings.autoConfirmationHours.toNumber()
      : env.AUTO_CONFIRMATION_HOURS;
    const now = new Date(),
      autoConfirmAt = new Date(now.getTime() + confirmationHours * 3600000);
    await event(tx, id, "Delivered", actor, "Seller marked delivery.");
    await event(
      tx,
      id,
      "WaitingConfirmation",
      actor,
      "Buyer confirmation period started.",
    );
    await notify(
      tx,
      [order.buyerId],
      "DELIVERY",
      "Delivery ready for confirmation",
      "Check your delivery. Confirm it or contact support before the countdown expires.",
      `/orders/${id}`,
    );
    return orderOutput(
      await tx.order.update({
        where: { id },
        data: {
          status: "WaitingConfirmation",
          deliveryNote,
          deliveredAt: now,
          autoConfirmAt,
        },
      }),
    );
  });
}

// Call only with the order row locked. All funds and audit records commit together.
export async function settle(
  tx: Prisma.TransactionClient,
  order: Order,
  actor: Actor | null,
  cancel: boolean,
) {
  await lockWallets(tx, [order.buyerId, order.sellerId]);
  if (cancel) await ledger(tx, order.buyerId, order, "REFUND", 1, -1);
  else {
    await ledger(tx, order.buyerId, order, "RELEASE", 0, -1);
    await ledger(tx, order.sellerId, order, "SALE", 1, 0);
  }
  const status = cancel ? "Cancelled" : "Completed";
  await event(
    tx,
    order.id,
    status,
    actor,
    cancel
      ? "Held funds refunded to buyer."
      : "Held funds released to seller exactly once.",
  );
  await notify(
    tx,
    [order.buyerId, order.sellerId],
    "ORDER",
    `Order ${status}`,
    cancel
      ? "Held Coin returned to the buyer's available balance."
      : "Delivery completed. Coin released to the seller's available balance.",
    `/orders/${order.id}`,
  );
  return orderOutput(
    await tx.order.update({
      where: { id: order.id },
      data: {
        status,
        autoConfirmAt: null,
        pausedFrom: null,
        pausedRemainingMs: null,
        ...(cancel
          ? { cancelledAt: new Date() }
          : {
              completedAt: new Date(),
              confirmedAt: actor ? new Date() : null,
            }),
      },
    }),
  );
}
export async function confirm(actor: Actor, id: string) {
  return prisma.$transaction(
    async (tx) => {
      const order = await lockedOrder(tx, id);
      requireAccess(order.buyerId === actor.id && actor.role === "BUYER");
      if (order.status === "Completed") return orderOutput(order);
      if (order.status !== "WaitingConfirmation")
        throw new AppError(
          409,
          "INVALID_ORDER_STATE",
          "This order cannot be confirmed now.",
        );
      return settle(tx, order, actor, false);
    },
    { timeout: 15000 },
  );
}
export async function cancelOrder(actor: Actor, id: string) {
  return prisma.$transaction(
    async (tx) => {
      const order = await lockedOrder(tx, id);
      participant(order, actor);
      if (order.status === "Cancelled") return orderOutput(order);
      if (order.status !== "WaitingDelivery")
        throw new AppError(
          409,
          "INVALID_ORDER_STATE",
          "After delivery, open support to request a refund.",
        );
      return settle(tx, order, actor, true);
    },
    { timeout: 15000 },
  );
}
export async function autoConfirm(id: string) {
  return prisma.$transaction(
    async (tx) => {
      const order = await lockedOrder(tx, id);
      if (
        order.status !== "WaitingConfirmation" ||
        !order.autoConfirmAt ||
        order.autoConfirmAt.getTime() > Date.now()
      )
        return false;
      await settle(tx, order, null, false);
      return true;
    },
    { timeout: 15000 },
  );
}
