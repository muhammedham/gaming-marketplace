import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "./auth.service.js";

const testEmailSuffix = "@auth.test.local";

function sessionCookie(response: { headers: Record<string, unknown> }) {
  const value = response.headers["set-cookie"];
  const header = Array.isArray(value) ? value[0] : value;
  return typeof header === "string" ? header.split(";", 1)[0] : "";
}

describe("Auth API", () => {
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

  it("registers a user and creates a zero-balance wallet", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Test Buyer",
        email: `buyer${testEmailSuffix}`,
        password: "Buyer123!",
        role: "BUYER",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      user: { email: `buyer${testEmailSuffix}`, role: "BUYER" },
      wallet: { availableBalance: "0.00", heldBalance: "0.00", currency: "COIN" },
    });
    expect(sessionCookie(response)).toMatch(/^gm_session=/);

    const storedUser = await prisma.user.findUnique({
      where: { email: `buyer${testEmailSuffix}` },
      include: { wallet: true },
    });
    expect(storedUser?.wallet?.availableBalance.toFixed(2)).toBe("0.00");
  });

  it("rejects duplicate email registration", async () => {
    const payload = {
      name: "Duplicate Buyer",
      email: `duplicate${testEmailSuffix}`,
      password: "Buyer123!",
      role: "BUYER",
    };

    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("rejects a display name containing only whitespace", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "  ",
        email: `blank-name${testEmailSuffix}`,
        password: "Buyer123!",
        role: "BUYER",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "VALIDATION_ERROR",
      details: { name: ["Name must contain at least 2 characters."] },
    });
  });

  it("rejects invalid credentials and unauthenticated profile access", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: `missing${testEmailSuffix}`, password: "Wrong123!" },
    });
    const meResponse = await app.inject({ method: "GET", url: "/api/v1/auth/me" });

    expect(loginResponse.statusCode).toBe(401);
    expect(loginResponse.json().error.code).toBe("INVALID_CREDENTIALS");
    expect(meResponse.statusCode).toBe(401);
    expect(meResponse.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the session for a valid cookie and clears it on logout", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Session Seller",
        email: `seller${testEmailSuffix}`,
        password: "Seller123!",
        role: "SELLER",
      },
    });
    const cookie = sessionCookie(registerResponse);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().data.user.role).toBe("SELLER");
    expect(logoutResponse.statusCode).toBe(204);
    expect(logoutResponse.headers["set-cookie"]).toContain("gm_session=;");
  });

  it("enforces the current database role for the Admin endpoint", async () => {
    const buyerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Role Buyer",
        email: `role${testEmailSuffix}`,
        password: "Buyer123!",
        role: "BUYER",
      },
    });
    const buyerAdminResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/session",
      headers: { cookie: sessionCookie(buyerResponse) },
    });

    const adminEmail = `admin${testEmailSuffix}`;
    await prisma.user.create({
      data: {
        name: "Test Admin",
        email: adminEmail,
        passwordHash: await hashPassword("Admin123!"),
        role: "ADMIN",
        wallet: { create: {} },
      },
    });

    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: adminEmail, password: "Admin123!" },
    });
    const adminCookie = sessionCookie(adminLogin);
    const adminResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/session",
      headers: { cookie: adminCookie },
    });

    await prisma.user.update({ where: { email: adminEmail }, data: { role: "BUYER" } });
    const demotedAdminResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/session",
      headers: { cookie: adminCookie },
    });

    expect(buyerAdminResponse.statusCode).toBe(403);
    expect(buyerAdminResponse.json().error.code).toBe("FORBIDDEN");
    expect(adminLogin.statusCode).toBe(200);
    expect(adminResponse.statusCode).toBe(200);
    expect(adminResponse.json().data.user.role).toBe("ADMIN");
    expect(demotedAdminResponse.statusCode).toBe(403);
  });
});
