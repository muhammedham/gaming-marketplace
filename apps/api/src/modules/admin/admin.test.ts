import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

const suffix = "@sprint5.test.local";

describe("Sprint 5 Admin API", () => {
  let app: FastifyInstance;
  let admin: string;
  let adminId: string;
  let buyer: string;
  let buyerId: string;
  let seller: string;
  let listingId: string;
  let categoryId: string;

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

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: suffix } },
      select: { id: true },
    });
    const ids = users.map((item) => item.id);
    const orders = await prisma.order.findMany({
      where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] },
      select: { id: true },
    });
    const orderIds = orders.map((item) => item.id);
    await prisma.adminAuditLog.deleteMany({ where: { adminId: { in: ids } } });
    await prisma.review.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.supportTicket.deleteMany({ where: { userId: { in: ids } } });
    await prisma.conversation.deleteMany({
      where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] },
    });
    await prisma.walletTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.listing.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: "sprint5-test" } } });
    await prisma.game.deleteMany({ where: { slug: { startsWith: "sprint5-test" } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.systemSettings.update({
      where: { id: 1 },
      data: { coinTryRate: "1", withdrawalFeeRate: "0", autoConfirmationHours: env.AUTO_CONFIRMATION_HOURS },
    });
  }

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  beforeEach(async () => {
    await cleanup();
    const users = await Promise.all(
      (["admin", "backup-admin", "buyer", "seller"] as const).map((name) =>
        prisma.user.create({
          data: {
            name: `Sprint5 ${name}`,
            email: `${name}${suffix}`,
            passwordHash: "test-only",
            role: name.includes("admin") ? "ADMIN" : name === "seller" ? "SELLER" : "BUYER",
            wallet: { create: {} },
          },
        }),
      ),
    );
    [adminId, , buyerId] = users.map((item) => item.id);
    [admin, , buyer, seller] = users.map(
      (item) => `${env.AUTH_COOKIE_NAME}=${app.jwt.sign({ role: item.role }, { sub: item.id })}`,
    );
    const category = await prisma.category.create({
      data: { name: "Sprint5 Test Category", slug: `sprint5-test-category-${randomUUID()}`, description: "Admin test category" },
    });
    const game = await prisma.game.create({
      data: { name: `Sprint5 Test Game ${randomUUID()}`, slug: `sprint5-test-game-${randomUUID()}` },
    });
    categoryId = category.id;
    listingId = (
      await prisma.listing.create({
        data: {
          sellerId: users[3].id,
          categoryId,
          gameId: game.id,
          title: "Sprint 5 admin test listing",
          description: "Test listing for Admin integration coverage.",
          price: "40.00",
          media: { create: { role: "COVER", storageKey: `test/${randomUUID()}.png`, mimeType: "image/png", sizeBytes: 10, altText: "Test" } },
        },
      })
    ).id;
    expect((await request("POST", "/wallet/deposits/simulate", buyer, { amountTry: "100", idempotencyKey: randomUUID() })).statusCode).toBe(201);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it("protects every Admin route and returns operational dashboard data", async () => {
    expect((await request("GET", "/admin/dashboard")).statusCode).toBe(401);
    expect((await request("GET", "/admin/dashboard", buyer)).statusCode).toBe(403);
    const response = await request("GET", "/admin/dashboard", admin);
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      counts: { users: expect.any(Number), activeListings: expect.any(Number) },
      balances: { availableCoin: expect.any(String), heldCoin: expect.any(String) },
      ordersByStatus: expect.any(Object),
      recentLedger: expect.any(Array),
    });
  });

  it("manages users and taxonomy with self, final Admin and cascade protections", async () => {
    const categoryName = `Sprint5 Test Admin Created ${randomUUID()}`;
    const created = await request("POST", "/admin/categories", admin, {
      name: categoryName,
      description: "Created through the protected Admin API.",
    });
    expect(created.statusCode).toBe(201);
    expect((await request("POST", "/admin/categories", admin, { name: categoryName, description: "Duplicate category" })).statusCode).toBe(409);

    const hidden = await request("PATCH", `/admin/categories/${categoryId}`, admin, { status: "INACTIVE" });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json().data.hiddenListings).toBe(1);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe("INACTIVE");

    expect((await request("PATCH", `/admin/users/${adminId}`, admin, { status: "SUSPENDED" })).json().error.code).toBe("ADMIN_SELF_PROTECTION");
    expect((await request("PATCH", `/admin/users/${buyerId}`, admin, { status: "SUSPENDED" })).statusCode).toBe(200);
    expect((await request("GET", "/wallet", buyer)).json().error.code).toBe("ACCOUNT_SUSPENDED");
    expect(await prisma.adminAuditLog.count({ where: { adminId } })).toBeGreaterThanOrEqual(3);
  });

  it("updates validated settings and settles a permitted order action exactly once", async () => {
    const settings = await request("PATCH", "/admin/settings", admin, {
      coinTryRate: "1.000000",
      withdrawalFeeRate: "0.050000",
      autoConfirmationHours: "0.0100",
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().data.autoConfirmationHours).toBe("0.0100");
    expect((await request("PATCH", "/admin/settings", admin, { coinTryRate: "0", withdrawalFeeRate: "2", autoConfirmationHours: "0" })).statusCode).toBe(400);

    const order = (await request("POST", "/orders", buyer, { listingId, expectedPrice: "40.00", idempotencyKey: randomUUID() })).json().data;
    const delivered = await request("POST", `/orders/${order.id}/deliver`, seller, { deliveryNote: "Delivered for Admin settlement." });
    expect(new Date(delivered.json().data.autoConfirmAt).getTime() - new Date(delivered.json().data.deliveredAt).getTime()).toBe(36_000);
    const completed = await request("POST", `/admin/orders/${order.id}/action`, admin, { action: "Complete", note: "Verified delivery evidence." });
    expect(completed.json().data.status).toBe("Completed");
    expect((await request("POST", `/admin/orders/${order.id}/action`, admin, { action: "Complete", note: "Duplicate attempt." })).statusCode).toBe(409);
    expect(await prisma.walletTransaction.count({ where: { orderId: order.id, type: "SALE" } })).toBe(1);
  });

  it("shows simulated withdrawals and SupportPaused records to Admin", async () => {
    expect((await request("POST", "/wallet/withdrawals/simulate", buyer, { amountCoin: "5", iban: "TR000000000000000000000000", accountHolderName: "Sprint Five Buyer", idempotencyKey: randomUUID() })).statusCode).toBe(201);
    const order = (await request("POST", "/orders", buyer, { listingId, expectedPrice: "40.00", idempotencyKey: randomUUID() })).json().data;
    expect((await request("POST", "/support/tickets", buyer, { orderId: order.id, subject: "Final demo support", body: "Pause this order for Admin review." })).statusCode).toBe(201);

    const withdrawals = await request("GET", "/admin/withdrawals", admin);
    const support = await request("GET", "/admin/support?status=Open", admin);
    expect(withdrawals.json().data.items[0]).toMatchObject({ simulation: true, amountCoin: "5.00" });
    expect(support.json().data.items[0].order.status).toBe("SupportPaused");
  });
});
