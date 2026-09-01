import { Prisma, type TicketStatus } from "@prisma/client";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { event, lockedOrder, settle } from "../orders/orders.service.js";
import {
  notify,
  pageArgs,
  paged,
  publicUser,
  requireAccess,
  textValue,
  type Actor,
  type Page,
} from "../orders/orders.shared.js";

const chatInclude = {
  buyer: { select: publicUser },
  seller: { select: publicUser },
  listing: { select: { title: true } },
} satisfies Prisma.ConversationInclude;
const messageInclude = {
  sender: { select: publicUser },
} satisfies Prisma.MessageInclude;
const ticketInclude = {
  user: { select: publicUser },
  order: { select: { id: true, status: true, listingTitle: true } },
} satisfies Prisma.SupportTicketInclude;

export async function startConversation(actor: Actor, listingId: string) {
  requireAccess(actor.role === "BUYER");
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "ACTIVE")
    throw new AppError(404, "LISTING_NOT_FOUND", "Active listing not found.");
  requireAccess(listing.sellerId !== actor.id);
  return prisma.conversation.upsert({
    where: { contextKey: `listing-${listingId}-${actor.id}` },
    create: {
      contextKey: `listing-${listingId}-${actor.id}`,
      buyerId: actor.id,
      sellerId: listing.sellerId,
      listingId,
    },
    update: {},
    include: chatInclude,
  });
}
export async function listConversations(actor: Actor, query: Page) {
  const where = { OR: [{ buyerId: actor.id }, { sellerId: actor.id }] };
  const { skip, take } = pageArgs(query);
  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: chatInclude,
    }),
    prisma.conversation.count({ where }),
  ]);
  return paged(items, total, query);
}
export async function getConversation(
  actor: Actor,
  id: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const chat = await tx.conversation.findUnique({
    where: { id },
    include: chatInclude,
  });
  if (!chat)
    throw new AppError(
      404,
      "CONVERSATION_NOT_FOUND",
      "Conversation not found.",
    );
  requireAccess(
    actor.role === "ADMIN" || [chat.buyerId, chat.sellerId].includes(actor.id),
  );
  return chat;
}
export async function listMessages(
  actor: Actor,
  id: string,
  query: Page,
  ticket = false,
) {
  if (ticket) await getTicket(actor, id);
  else await getConversation(actor, id);
  const where = ticket ? { ticketId: id } : { conversationId: id };
  const { skip, take } = pageArgs(query);
  const [items, total] = await Promise.all([
    prisma.message.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: messageInclude,
    }),
    prisma.message.count({ where }),
  ]);
  return paged(items.reverse(), total, query);
}
export async function sendMessage(actor: Actor, id: string, input: string) {
  const body = textValue(input);
  return prisma.$transaction(async (tx) => {
    const chat = await getConversation(actor, id, tx);
    requireAccess([chat.buyerId, chat.sellerId].includes(actor.id));
    const result = await tx.message.create({
      data: { senderId: actor.id, conversationId: id, body },
      include: messageInclude,
    });
    await tx.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    await notify(
      tx,
      [actor.id === chat.buyerId ? chat.sellerId : chat.buyerId],
      "MESSAGE",
      "New message",
      `New message about ${chat.listing.title}.`,
      `/messages/${id}`,
    );
    return result;
  });
}

export async function getTicket(
  actor: Actor,
  id: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const ticket = await tx.supportTicket.findUnique({
    where: { id },
    include: ticketInclude,
  });
  if (!ticket)
    throw new AppError(404, "TICKET_NOT_FOUND", "Support ticket not found.");
  requireAccess(actor.role === "ADMIN" || actor.id === ticket.userId);
  return ticket;
}
async function lockTicket(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM support_tickets WHERE id = ${id}::uuid FOR UPDATE`;
}
async function notifyAdmins(
  tx: Prisma.TransactionClient,
  title: string,
  id: string,
) {
  const admins = await tx.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  await notify(
    tx,
    admins.map((a) => a.id),
    "SUPPORT",
    title,
    "A support ticket needs your attention.",
    `/support/${id}`,
  );
}
export async function createTicket(
  actor: Actor,
  input: { orderId?: string; subject: string; body: string },
) {
  const subject = textValue(input.subject, "subject"),
    body = textValue(input.body);
  return prisma.$transaction(async (tx) => {
    if (input.orderId) {
      const order = await lockedOrder(tx, input.orderId);
      requireAccess(order.buyerId === actor.id);
      if (order.status === "SupportPaused")
        throw new AppError(
          409,
          "SUPPORT_ALREADY_OPEN",
          "An active ticket already pauses this order.",
        );
      if (!["WaitingDelivery", "WaitingConfirmation"].includes(order.status))
        throw new AppError(
          409,
          "INVALID_ORDER_STATE",
          "Open a general ticket for a finished order.",
        );
      const remaining = order.autoConfirmAt
        ? order.autoConfirmAt.getTime() - Date.now()
        : null;
      if (remaining !== null && remaining <= 0)
        throw new AppError(
          409,
          "CONFIRMATION_EXPIRED",
          "The confirmation period has expired. You can still open a general ticket.",
        );
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "SupportPaused",
          pausedFrom: order.status,
          pausedRemainingMs: remaining,
          autoConfirmAt: null,
        },
      });
      await event(
        tx,
        order.id,
        "SupportPaused",
        actor,
        "Buyer opened support; countdown paused and funds remain held.",
      );
      await notify(
        tx,
        [order.buyerId, order.sellerId],
        "SUPPORT",
        "Order paused for support",
        "Automatic confirmation is stopped. Funds remain held while support reviews the order.",
        `/orders/${order.id}`,
      );
    }
    const ticket = await tx.supportTicket.create({
      data: {
        userId: actor.id,
        orderId: input.orderId,
        subject,
        messages: { create: { senderId: actor.id, body } },
      },
      include: ticketInclude,
    });
    await notifyAdmins(tx, "New support ticket", ticket.id);
    return ticket;
  });
}
export async function listTickets(actor: Actor, query: Page) {
  const where = actor.role === "ADMIN" ? {} : { userId: actor.id };
  const { skip, take } = pageArgs(query);
  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: ticketInclude,
    }),
    prisma.supportTicket.count({ where }),
  ]);
  return paged(items, total, query);
}
export async function replyTicket(actor: Actor, id: string, input: string) {
  const body = textValue(input);
  return prisma.$transaction(async (tx) => {
    await lockTicket(tx, id);
    const ticket = await getTicket(actor, id, tx);
    if (ticket.status === "Closed")
      throw new AppError(409, "TICKET_CLOSED", "This ticket is closed.");
    const result = await tx.message.create({
      data: { senderId: actor.id, ticketId: id, body },
      include: messageInclude,
    });
    await tx.supportTicket.update({
      where: { id },
      data: { status: actor.role === "ADMIN" ? "Answered" : "Open" },
    });
    if (actor.role === "ADMIN")
      await notify(
        tx,
        [ticket.userId],
        "SUPPORT",
        "Support replied",
        "There is a new reply to your ticket.",
        `/support/${id}`,
      );
    else await notifyAdmins(tx, "New support reply", id);
    return result;
  });
}
export async function updateTicketStatus(
  actor: Actor,
  id: string,
  status: TicketStatus,
) {
  requireAccess(actor.role === "ADMIN");
  return prisma.$transaction(async (tx) => {
    await lockTicket(tx, id);
    const ticket = await getTicket(actor, id, tx);
    if (status === "Closed" && ticket.order?.status === "SupportPaused")
      throw new AppError(
        409,
        "RESOLUTION_REQUIRED",
        "Resolve the paused order before closing this ticket.",
      );
    if (ticket.status === "Closed" && status !== "Closed")
      throw new AppError(
        409,
        "TICKET_CLOSED",
        "Open a new ticket instead of reopening a resolved ticket.",
      );
    if (ticket.status !== status) {
      await tx.message.create({
        data: {
          ticketId: id,
          senderId: actor.id,
          body: `Support status changed to ${status}.`,
        },
      });
      await notify(
        tx,
        [ticket.userId],
        "SUPPORT",
        "Support status updated",
        `Your ticket is now ${status}.`,
        `/support/${id}`,
      );
    }
    return tx.supportTicket.update({
      where: { id },
      data: { status },
      include: ticketInclude,
    });
  });
}
export async function resolveTicket(
  actor: Actor,
  id: string,
  input: { action: "Resume" | "Complete" | "Cancel"; body: string },
) {
  requireAccess(actor.role === "ADMIN");
  const body = textValue(input.body);
  return prisma.$transaction(
    async (tx) => {
      await lockTicket(tx, id);
      const ticket = await getTicket(actor, id, tx);
      if (ticket.status === "Closed")
        throw new AppError(
          409,
          "TICKET_CLOSED",
          "This ticket was already resolved.",
        );
      if (!ticket.orderId)
        throw new AppError(
          409,
          "ORDER_REQUIRED",
          "Only order-linked tickets have an order resolution.",
        );
      const order = await lockedOrder(tx, ticket.orderId);
      if (order.status !== "SupportPaused")
        throw new AppError(
          409,
          "INVALID_ORDER_STATE",
          "The order is not paused for support.",
        );
      if (input.action === "Resume") {
        const status =
          order.pausedFrom === "WaitingConfirmation"
            ? "WaitingConfirmation"
            : "WaitingDelivery";
        const autoConfirmAt =
          status === "WaitingConfirmation"
            ? new Date(Date.now() + Math.max(1, order.pausedRemainingMs ?? 0))
            : null;
        await tx.order.update({
          where: { id: order.id },
          data: {
            status,
            autoConfirmAt,
            pausedFrom: null,
            pausedRemainingMs: null,
          },
        });
        await event(
          tx,
          order.id,
          status,
          actor,
          "Admin resumed the order with its remaining confirmation time.",
        );
        await notify(
          tx,
          [order.buyerId, order.sellerId],
          "ORDER",
          "Order resumed",
          "Support resumed the delivery process. Any countdown continues from the time that remained.",
          `/orders/${order.id}`,
        );
      } else await settle(tx, order, actor, input.action === "Cancel");
      await tx.message.create({
        data: {
          ticketId: id,
          senderId: actor.id,
          body: `${input.action}: ${body}`.slice(0, 2000),
        },
      });
      await notify(
        tx,
        [ticket.userId],
        "SUPPORT",
        "Support resolved your ticket",
        `Resolution: ${input.action}. Read the admin reply.`,
        `/support/${id}`,
      );
      return tx.supportTicket.update({
        where: { id },
        data: { status: "Closed" },
        include: ticketInclude,
      });
    },
    { timeout: 15000 },
  );
}
export async function createReview(
  actor: Actor,
  orderId: string,
  input: { rating: number; comment?: string },
) {
  return prisma.$transaction(async (tx) => {
    const order = await lockedOrder(tx, orderId);
    requireAccess(actor.id === order.buyerId && actor.role === "BUYER");
    if (order.status !== "Completed")
      throw new AppError(
        409,
        "ORDER_NOT_COMPLETED",
        "Only completed orders can be reviewed.",
      );
    if (await tx.review.findUnique({ where: { orderId } }))
      throw new AppError(
        409,
        "REVIEW_EXISTS",
        "This order already has a review.",
      );
    const review = await tx.review.create({
      data: {
        orderId,
        buyerId: actor.id,
        sellerId: order.sellerId,
        rating: input.rating,
        comment: input.comment?.trim() ?? "",
      },
    });
    await notify(
      tx,
      [order.sellerId],
      "REVIEW",
      "New seller review",
      `You received a ${input.rating}/5 review.`,
      `/sellers/${order.sellerId}`,
    );
    return review;
  });
}
export async function sellerProfile(id: string, query: Page) {
  const seller = await prisma.user.findUnique({
    where: { id },
    select: { ...publicUser, createdAt: true },
  });
  if (!seller || seller.role !== "SELLER")
    throw new AppError(404, "SELLER_NOT_FOUND", "Seller not found.");
  const { skip, take } = pageArgs(query);
  const [summary, reviews, completedSales, listings] = await Promise.all([
    prisma.review.aggregate({
      where: { sellerId: id },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.review.findMany({
      where: { sellerId: id },
      skip,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        buyer: { select: { name: true } },
      },
    }),
    prisma.order.count({ where: { sellerId: id, status: "Completed" } }),
    prisma.listing.findMany({
      where: { sellerId: id, status: "ACTIVE" },
      take: 12,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, price: true },
    }),
  ]);
  return {
    seller,
    averageRating: summary._avg.rating,
    reviewCount: summary._count,
    completedSales,
    reviews: paged(reviews, summary._count, query),
    listings: listings.map((l) => ({ ...l, price: l.price.toFixed(2) })),
  };
}
export async function listNotifications(actor: Actor, query: Page) {
  const where = { userId: actor.id },
    { skip, take } = pageArgs(query);
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);
  return { ...paged(items, total, query), unreadCount };
}
export async function markNotification(actor: Actor, id?: string) {
  const result = await prisma.notification.updateMany({
    where: { userId: actor.id, ...(id ? { id } : {}) },
    data: { isRead: true },
  });
  if (id && result.count === 0)
    throw new AppError(
      404,
      "NOTIFICATION_NOT_FOUND",
      "Notification not found.",
    );
  return { updated: result.count };
}
