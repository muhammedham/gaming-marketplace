import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

const testEmailSuffix = "@wallet.test.local";

function sessionCookie(response: { headers: Record<string, unknown> }) {
  const value = response.headers["set-cookie"];
  const header = Array.isArray(value) ? value[0] : value;
  return typeof header === "string" ? header.split(";", 1)[0] : "";
}

describe("Wallet API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: testEmailSuffix } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: testEmailSuffix } } });
    await app.close();
  });

  it("deposits and withdraws available funds atomically", async () => {
    const email = `buyer${testEmailSuffix}`;
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { name: "Wallet Buyer", email, password: "Buyer123!", role: "BUYER" },
    });
    const cookie = sessionCookie(register);

    const deposit = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/deposit",
      headers: { cookie },
      payload: { amount: "25.50", idempotencyKey: "deposit-buyer-001" },
    });
    expect(deposit.statusCode).toBe(200);
    expect(deposit.json().data).toMatchObject({ availableBalance: "25.50", heldBalance: "0.00" });

    const withdraw = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/withdraw",
      headers: { cookie },
      payload: { amount: "5.50", idempotencyKey: "withdraw-buyer-001" },
    });
    expect(withdraw.statusCode).toBe(200);
    expect(withdraw.json().data.availableBalance).toBe("20.00");

    const repeated = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/withdraw",
      headers: { cookie },
      payload: { amount: "5.50", idempotencyKey: "withdraw-buyer-001" },
    });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().data.availableBalance).toBe("20.00");

    const transactions = await prisma.walletTransaction.findMany({
      where: { wallet: { user: { email } } },
      orderBy: { createdAt: "asc" },
    });
    expect(transactions.map((transaction) => transaction.type)).toEqual(["DEPOSIT", "WITHDRAWAL"]);
  });

  it("rejects withdrawals that exceed available funds", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Empty Buyer",
        email: `empty${testEmailSuffix}`,
        password: "Buyer123!",
        role: "BUYER",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/withdraw",
      headers: { cookie: sessionCookie(register) },
      payload: { amount: "0.01", idempotencyKey: "withdraw-empty-001" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("requires authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/wallet" });
    expect(response.statusCode).toBe(401);
  });
});