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

  it("converts TRY deposits, previews withdrawals, and keeps detail records", async () => {
    const email = `simulation${testEmailSuffix}`;
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { name: "Simulation Buyer", email, password: "Buyer123!", role: "BUYER" },
    });
    const cookie = sessionCookie(register);

    const deposit = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/deposits/simulate",
      headers: { cookie },
      payload: { amountTry: "10.00", idempotencyKey: "simulation-deposit-001" },
    });
    expect(deposit.statusCode).toBe(201);
    expect(deposit.json().data.deposit).toMatchObject({ amountTry: "10.00", coinAmount: "10.00" });

    const preview = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/withdrawals/preview",
      headers: { cookie },
      payload: { amountCoin: "4.00" },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().data).toMatchObject({ feeCoin: "0.00", netAmountTry: "4.00", canWithdraw: true });

    const withdrawal = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/withdrawals/simulate",
      headers: { cookie },
      payload: {
        amountCoin: "4.00",
        iban: "TR000000000000000000000000",
        accountHolderName: "Simulation Buyer",
        idempotencyKey: "simulation-withdraw-001",
      },
    });
    expect(withdrawal.statusCode).toBe(201);
    expect(withdrawal.json().data.withdrawal.ibanMasked).not.toContain("000000000000000000000000");

    const history = await app.inject({ method: "GET", url: "/api/v1/wallet/transactions", headers: { cookie } });
    expect(history.statusCode).toBe(200);
    expect(history.json().data.items).toHaveLength(2);
    expect(history.json().data.items.map((item: { type: string }) => item.type)).toEqual(["WITHDRAWAL", "DEPOSIT"]);

    const insufficient = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/withdrawals/simulate",
      headers: { cookie },
      payload: {
        amountCoin: "99.00",
        iban: "TR000000000000000000000000",
        accountHolderName: "Simulation Buyer",
        idempotencyKey: "simulation-withdraw-002",
      },
    });
    expect(insufficient.statusCode).toBe(400);
    expect(insufficient.json().error.code).toBe("INSUFFICIENT_FUNDS");
    expect((await app.inject({ method: "GET", url: "/api/v1/wallet", headers: { cookie } })).json().data.availableBalance).toBe("6.00");
  });
});
