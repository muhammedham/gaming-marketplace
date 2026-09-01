import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { autoConfirm } from "./orders.service.js";
import { startOrderJobs } from "./orders.jobs.js";

const suffix = "@sprint4.test.local";
describe("Sprint 4 orders and communication", () => {
  let app: FastifyInstance;
  let buyer: string,
    seller: string,
    other: string,
    admin: string,
    listingId: string,
    buyerId: string,
    sellerId: string;
  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: suffix } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    const orders = await prisma.order.findMany({
      where: { buyerId: { in: ids } },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    await prisma.review.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.supportTicket.deleteMany({ where: { userId: { in: ids } } });
    await prisma.conversation.deleteMany({
      where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] },
    });
    await prisma.walletTransaction.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.listing.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });
  beforeEach(async () => {
    await cleanup();
    const users = await Promise.all(
      (["buyer", "seller", "other", "admin"] as const).map((name) =>
        prisma.user.create({
          data: {
            name: `Sprint4 ${name}`,
            email: `${name}${suffix}`,
            passwordHash: "test-only-not-a-login-hash",
            role:
              name === "seller"
                ? "SELLER"
                : name === "admin"
                  ? "ADMIN"
                  : "BUYER",
            wallet: { create: {} },
          },
        }),
      ),
    );
    [buyer, seller, other, admin] = users.map(
      (u) =>
        `${env.AUTH_COOKIE_NAME}=${app.jwt.sign({ role: u.role }, { sub: u.id })}`,
    );
    buyerId = users[0].id;
    sellerId = users[1].id;
    const category = await prisma.category.findFirstOrThrow();
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId: category.id,
        title: "Sprint 4 test listing",
        description: "Test only",
        price: "40.00",
        media: {
          create: {
            role: "COVER",
            storageKey: `test/${randomUUID()}.png`,
            mimeType: "image/png",
            sizeBytes: 10,
            altText: "Test",
          },
        },
      },
    });
    listingId = listing.id;
    expect(
      (
        await request("POST", "/wallet/deposits/simulate", buyer, {
          amountTry: "100.00",
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(201);
  });
  afterAll(async () => {
    await cleanup();
    await app.close();
  });
  const request = (
    method: "GET" | "POST" | "PATCH",
    path: string,
    cookie?: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      headers: cookie ? { cookie } : {},
      ...(payload ? { payload } : {}),
    });
  async function buy(key = randomUUID()) {
    const r = await request("POST", "/orders", buyer, {
      listingId,
      expectedPrice: "40.00",
      idempotencyKey: key,
    });
    expect(r.statusCode, r.body).toBe(201);
    return r.json().data;
  }
  async function delivery(id: string) {
    const r = await request("POST", `/orders/${id}/deliver`, seller, {
      deliveryNote: "Delivered the test item.",
    });
    expect(r.statusCode, r.body).toBe(200);
    return r.json().data;
  }
  async function ticket(id: string) {
    const r = await request("POST", "/support/tickets", buyer, {
      orderId: id,
      subject: "Delivery issue",
      body: "Please check this delivery.",
    });
    expect(r.statusCode, r.body).toBe(201);
    return r.json().data;
  }
  async function wallet(cookie: string) {
    return (await request("GET", "/wallet", cookie)).json().data;
  }

  it("holds, records every status, delivers, and releases once under concurrent confirmations", async () => {
    const order = await buy();
    expect(await wallet(buyer)).toMatchObject({
      availableBalance: "60.00",
      heldBalance: "40.00",
    });
    const delivered = await delivery(order.id);
    expect(delivered.status).toBe("WaitingConfirmation");
    expect(
      new Date(delivered.autoConfirmAt).getTime() -
        new Date(delivered.deliveredAt).getTime(),
    ).toBe(env.AUTO_CONFIRMATION_HOURS * 3600000);
    const replies = await Promise.all([
      request("POST", `/orders/${order.id}/confirm`, buyer),
      request("POST", `/orders/${order.id}/confirm`, buyer),
      autoConfirm(order.id),
    ]);
    expect(replies[0]).toMatchObject({ statusCode: 200 });
    expect(replies[1]).toMatchObject({ statusCode: 200 });
    expect(await wallet(buyer)).toMatchObject({
      availableBalance: "60.00",
      heldBalance: "0.00",
    });
    expect(await wallet(seller)).toMatchObject({
      availableBalance: "40.00",
      heldBalance: "0.00",
    });
    expect(
      await prisma.walletTransaction.count({ where: { orderId: order.id } }),
    ).toBe(3);
    const detail = (await request("GET", `/orders/${order.id}`, buyer)).json()
      .data;
    expect(detail.events.map((e: { status: string }) => e.status)).toEqual([
      "Created",
      "Paid",
      "WaitingDelivery",
      "Delivered",
      "WaitingConfirmation",
      "Completed",
    ]);
    expect(
      detail.events.every(
        (e: { actorRole: string }) => e.actorRole !== "SYSTEM",
      ),
    ).toBe(true);
    // Existing withdrawal/deposit ledger validation must understand order movements too.
    expect(
      (
        await request("POST", "/wallet/deposits/simulate", buyer, {
          amountTry: "1.00",
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await request("POST", "/wallet/withdrawals/simulate", seller, {
          amountCoin: "1.00",
          iban: "TR000000000000000000000000",
          accountHolderName: "Test Seller",
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(201);
  });
  it("replays purchases and rejects key reuse or stale prices", async () => {
    const key = randomUUID(),
      results = await Promise.all([buy(key), buy(key)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await wallet(buyer)).toMatchObject({
      availableBalance: "60.00",
      heldBalance: "40.00",
    });
    expect(
      (
        await request("POST", "/orders", buyer, {
          listingId,
          expectedPrice: "41.00",
          idempotencyKey: key,
        })
      ).json().error.code,
    ).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(
      (
        await request("POST", "/orders", buyer, {
          listingId,
          expectedPrice: "41.00",
          idempotencyKey: randomUUID(),
        })
      ).json().error.code,
    ).toBe("PRICE_CHANGED");
  });
  it("rolls back insufficient and unavailable purchases, including racing purchases", async () => {
    await buy();
    const attempts = await Promise.all([
      request("POST", "/orders", buyer, {
        listingId,
        expectedPrice: "40.00",
        idempotencyKey: randomUUID(),
      }),
      request("POST", "/orders", buyer, {
        listingId,
        expectedPrice: "40.00",
        idempotencyKey: randomUUID(),
      }),
    ]);
    expect(attempts.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await prisma.order.count({ where: { buyerId } })).toBe(2);
    expect(await wallet(buyer)).toMatchObject({
      availableBalance: "20.00",
      heldBalance: "80.00",
    });
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "INACTIVE" },
    });
    expect(
      (
        await request("POST", "/orders", buyer, {
          listingId,
          expectedPrice: "40.00",
          idempotencyKey: randomUUID(),
        })
      ).json().error.code,
    ).toBe("LISTING_UNAVAILABLE");
  });
  it("enforces authentication, roles, ownership, and lifecycle boundaries", async () => {
    const order = await buy();
    expect((await request("GET", "/orders")).statusCode).toBe(401);
    expect(
      (await request("GET", `/orders/${order.id}`, other)).statusCode,
    ).toBe(403);
    expect(
      (
        await request("POST", "/orders", seller, {
          listingId,
          expectedPrice: "40.00",
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request("POST", `/orders/${order.id}/deliver`, buyer, {
          deliveryNote: "wrong role",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await request("POST", `/orders/${order.id}/confirm`, buyer)).statusCode,
    ).toBe(409);
    expect(
      (await request("POST", `/orders/${order.id}/confirm`, seller)).statusCode,
    ).toBe(403);
    expect(
      (await request("POST", `/orders/${order.id}/cancel`, other)).statusCode,
    ).toBe(403);
    await delivery(order.id);
    expect(
      (await request("POST", `/orders/${order.id}/cancel`, buyer)).statusCode,
    ).toBe(409);
    expect((await request("GET", "/orders", other)).json().data.items).toEqual(
      [],
    );
  });
  it("cancels before delivery and refunds only once", async () => {
    const order = await buy();
    await Promise.all([
      request("POST", `/orders/${order.id}/cancel`, buyer),
      request("POST", `/orders/${order.id}/cancel`, seller),
    ]);
    expect(await wallet(buyer)).toMatchObject({
      availableBalance: "100.00",
      heldBalance: "0.00",
    });
    expect(await wallet(seller)).toMatchObject({ availableBalance: "0.00" });
    expect(
      await prisma.walletTransaction.count({
        where: { orderId: order.id, type: "REFUND" },
      }),
    ).toBe(1);
    expect(await autoConfirm(order.id)).toBe(false);
  });
  it("pauses support, rejects late/duplicate tickets, and admin refund is atomic", async () => {
    const order = await buy();
    await delivery(order.id);
    const support = await ticket(order.id);
    expect(await autoConfirm(order.id)).toBe(false);
    expect(
      (await request("GET", `/orders/${order.id}`, buyer)).json().data,
    ).toMatchObject({ status: "SupportPaused", autoConfirmAt: null });
    expect(
      (await request("POST", `/orders/${order.id}/confirm`, buyer)).statusCode,
    ).toBe(409);
    expect(
      (
        await request("POST", "/support/tickets", buyer, {
          orderId: order.id,
          subject: "Again",
          body: "Repeat",
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await request("PATCH", `/support/tickets/${support.id}`, admin, {
          status: "Closed",
        })
      ).json().error.code,
    ).toBe("RESOLUTION_REQUIRED");
    expect(
      (
        await request("POST", `/support/tickets/${support.id}/resolve`, buyer, {
          action: "Cancel",
          body: "No access",
        })
      ).statusCode,
    ).toBe(403);
    const result = await request(
      "POST",
      `/support/tickets/${support.id}/resolve`,
      admin,
      { action: "Cancel", body: "Refund approved." },
    );
    expect(result.statusCode, result.body).toBe(200);
    expect(await wallet(buyer)).toMatchObject({
      availableBalance: "100.00",
      heldBalance: "0.00",
    });
    expect(await autoConfirm(order.id)).toBe(false);
  });
  it("resumes the saved time, invalidates stale jobs and supports admin completion", async () => {
    const order = await buy();
    await delivery(order.id);
    const support = await ticket(order.id);
    const paused = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    const r = await request(
      "POST",
      `/support/tickets/${support.id}/resolve`,
      admin,
      { action: "Resume", body: "Continue delivery confirmation." },
    );
    expect(r.statusCode, r.body).toBe(200);
    const resumed = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(resumed.autoConfirmAt!.getTime() - Date.now()).toBeGreaterThan(
      paused.pausedRemainingMs! - 2000,
    );
    expect(await autoConfirm(order.id)).toBe(false);
    const again = await ticket(order.id);
    expect(
      (
        await request("POST", `/support/tickets/${again.id}/resolve`, admin, {
          action: "Complete",
          body: "Delivery evidence accepted.",
        })
      ).statusCode,
    ).toBe(200);
    expect(await wallet(seller)).toMatchObject({ availableBalance: "40.00" });
    expect(
      (
        await request("POST", `/support/tickets/${again.id}/resolve`, admin, {
          action: "Complete",
          body: "Duplicate",
        })
      ).statusCode,
    ).toBe(409);
  });
  it("rejects support after deadline and completes overdue orders only once", async () => {
    const order = await buy();
    await delivery(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { autoConfirmAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await request("POST", "/support/tickets", buyer, {
          orderId: order.id,
          subject: "Late",
          body: "Too late",
        })
      ).json().error.code,
    ).toBe("CONFIRMATION_EXPIRED");
    const result = await Promise.all([
      autoConfirm(order.id),
      autoConfirm(order.id),
      request("POST", `/orders/${order.id}/confirm`, buyer),
    ]);
    expect(result[2]).toMatchObject({ statusCode: 200 });
    expect(await wallet(seller)).toMatchObject({ availableBalance: "40.00" });
  });
  it("allows one 1-5 review only by the completed order buyer, and computes seller statistics", async () => {
    const order = await buy();
    expect(
      (
        await request("POST", `/orders/${order.id}/review`, buyer, {
          rating: 5,
        })
      ).statusCode,
    ).toBe(409);
    await delivery(order.id);
    await request("POST", `/orders/${order.id}/confirm`, buyer);
    expect(
      (
        await request("POST", `/orders/${order.id}/review`, other, {
          rating: 5,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request("POST", `/orders/${order.id}/review`, buyer, {
          rating: 6,
        })
      ).statusCode,
    ).toBe(400);
    const reviews = await Promise.all([
      request("POST", `/orders/${order.id}/review`, buyer, {
        rating: 4,
        comment: "Good delivery",
      }),
      request("POST", `/orders/${order.id}/review`, buyer, { rating: 4 }),
    ]);
    expect(reviews.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(
      (await request("GET", `/sellers/${sellerId}`)).json().data,
    ).toMatchObject({ averageRating: 4, reviewCount: 1, completedSales: 1 });
  });
  it("supports listing/order message history, pagination, and rejects unauthorized or empty messages", async () => {
    const order = await buy(),
      chat = order.conversation.id;
    expect(
      (
        await request("POST", `/conversations/${chat}/messages`, buyer, {
          body: "Hello seller",
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await request("POST", `/conversations/${chat}/messages`, seller, {
          body: "Hello buyer",
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await request(
          "GET",
          `/conversations/${chat}/messages?limit=1&page=1`,
          buyer,
        )
      ).json().data.pagination.total,
    ).toBe(2);
    expect(
      (await request("GET", `/conversations/${chat}/messages`, admin))
        .statusCode,
    ).toBe(200);
    expect(
      (await request("GET", `/conversations/${chat}/messages`, other))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await request("POST", `/conversations/${chat}/messages`, buyer, {
          body: "   ",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request("POST", `/conversations/${chat}/messages`, buyer, {
          body: "a".repeat(2001),
        })
      ).statusCode,
    ).toBe(400);
    const c = await request("POST", "/conversations", buyer, { listingId });
    expect(c.statusCode).toBe(201);
    expect(
      (await request("POST", "/conversations", buyer, { listingId })).json()
        .data.id,
    ).toBe(c.json().data.id);
    expect(
      (await request("GET", "/conversations", seller)).json().data.pagination
        .total,
    ).toBe(2);
  });
  it("protects support replies and read/unread notifications by ownership", async () => {
    const order = await buy(),
      support = await ticket(order.id);
    expect(
      (await request("GET", `/support/tickets/${support.id}`, seller))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "POST",
          `/support/tickets/${support.id}/messages`,
          other,
          { body: "No access" },
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request("PATCH", `/support/tickets/${support.id}`, admin, {
          status: "InProgress",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request(
          "POST",
          `/support/tickets/${support.id}/messages`,
          admin,
          { body: "We are checking." },
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (await request("GET", `/support/tickets/${support.id}`, buyer)).json()
        .data.status,
    ).toBe("Answered");
    const notifications = (await request("GET", "/notifications", buyer)).json()
      .data;
    expect(notifications.unreadCount).toBeGreaterThan(0);
    expect(
      (
        await request(
          "POST",
          `/notifications/${notifications.items[0].id}/read`,
          other,
        )
      ).statusCode,
    ).toBe(404);
    await request(
      "POST",
      `/notifications/${notifications.items[0].id}/read`,
      buyer,
    );
    await request("POST", "/notifications/read-all", buyer);
    expect(
      (await request("GET", "/notifications", buyer)).json().data.unreadCount,
    ).toBe(0);
    const resumed = await request(
      "POST",
      `/support/tickets/${support.id}/resolve`,
      admin,
      { action: "Resume", body: "Seller may deliver now." },
    );
    expect(resumed.json().data.order.status).toBe("WaitingDelivery");
  });
  it("runs a real Redis/BullMQ delayed job and recovers missing jobs after restart", async () => {
    const order = await buy();
    await delivery(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { autoConfirmAt: new Date(Date.now() + 500) },
    });
    const errors: Error[] = [];
    const queueName = `test-order-${randomUUID()}`;
    const jobs = startOrderJobs({
      queueName,
      orderIds: [order.id],
      intervalMs: 100,
      onError: (error) => errors.push(error),
    });
    try {
      await jobs.reconcile();
      await expect
        .poll(
          async () =>
            (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
              .status,
          { timeout: 10000 },
        )
        .toBe("Completed");
      expect(await wallet(seller)).toMatchObject({ availableBalance: "40.00" });
      expect(errors).toEqual([]);
    } finally {
      await jobs.close();
    }
    const restarted = startOrderJobs({
      queueName,
      orderIds: [order.id],
      intervalMs: 100,
      onError: (error) => errors.push(error),
    });
    try {
      await restarted.reconcile();
      expect(await wallet(seller)).toMatchObject({ availableBalance: "40.00" });
      await restarted.queue.obliterate({ force: true });
    } finally {
      await restarted.close();
    }
  }, 20000);
  it("keeps a paused order unpaid even when its real queued deadline passes", async () => {
    const order = await buy();
    await delivery(order.id);
    const deadline = new Date(Date.now() + 1200);
    await prisma.order.update({
      where: { id: order.id },
      data: { autoConfirmAt: deadline },
    });
    const errors: Error[] = [];
    const jobs = startOrderJobs({
      queueName: `test-paused-${randomUUID()}`,
      orderIds: [order.id],
      intervalMs: 100,
      onError: (error) => errors.push(error),
    });
    try {
      await jobs.reconcile();
      await ticket(order.id);
      await expect
        .poll(() => Date.now(), { timeout: 5000 })
        .toBeGreaterThan(deadline.getTime() + 300);
      await expect
        .poll(
          async () =>
            await jobs.queue.getJobCounts("active", "delayed", "wait"),
          { timeout: 5000 },
        )
        .toMatchObject({ active: 0, delayed: 0, wait: 0 });
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
          .status,
      ).toBe("SupportPaused");
      expect(await wallet(seller)).toMatchObject({ availableBalance: "0.00" });
      expect(await wallet(buyer)).toMatchObject({ heldBalance: "40.00" });
      expect(errors).toEqual([]);
      await jobs.queue.obliterate({ force: true });
    } finally {
      await jobs.close();
    }
  }, 15000);
  it("keeps price snapshots and immutable ledger records, and blocks spending Held Coin", async () => {
    const order = await buy();
    await prisma.listing.update({
      where: { id: listingId },
      data: { price: "99.00", title: "Changed after purchase" },
    });
    expect(
      (await request("GET", `/orders/${order.id}`, buyer)).json().data,
    ).toMatchObject({ price: "40.00", listingTitle: "Sprint 4 test listing" });
    expect(
      (
        await request("POST", "/wallet/withdrawals/simulate", buyer, {
          amountCoin: "61.00",
          iban: "TR000000000000000000000000",
          accountHolderName: "Test Buyer",
          idempotencyKey: randomUUID(),
        })
      ).json().error.code,
    ).toBe("INSUFFICIENT_FUNDS");
    const hold = await prisma.walletTransaction.findFirstOrThrow({
      where: { orderId: order.id, type: "HOLD" },
    });
    await expect(
      prisma.walletTransaction.update({
        where: { id: hold.id },
        data: { description: "tamper" },
      }),
    ).rejects.toThrow();
    await delivery(order.id);
    await request("POST", `/orders/${order.id}/confirm`, buyer);
    expect(await wallet(seller)).toMatchObject({ availableBalance: "40.00" });
  });
});
