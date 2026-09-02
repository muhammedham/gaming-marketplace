import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { encryptSecret, decryptSecret } from "../../lib/secret-crypto.js";
import {
  externalInferenceFailureMessage,
  externalInferenceRequestBody,
  externalInferenceUrl,
} from "./inventory-analysis.service.js";

const suffix = "@inventory-analysis.test.local";

describe("Valorant inventory analysis API", () => {
  let app: FastifyInstance;
  let sellerId: string;
  let sellerCookie: string;
  let otherSellerCookie: string;
  let listingId: string;

  async function cleanup() {
    const users = await prisma.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    const ids = users.map((item) => item.id);
    await prisma.inventoryAnalysis.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.listing.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.gameInferenceIntegration.deleteMany({ where: { game: { slug: "valorant" } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    await cleanup();
    const [seller, other, accounts, valorant] = await Promise.all([
      prisma.user.create({ data: { name: "Inventory Seller", email: `seller${suffix}`, passwordHash: "test", role: "SELLER", wallet: { create: {} } } }),
      prisma.user.create({ data: { name: "Other Seller", email: `other${suffix}`, passwordHash: "test", role: "SELLER", wallet: { create: {} } } }),
      prisma.category.findUniqueOrThrow({ where: { slug: "accounts" } }),
      prisma.game.findUniqueOrThrow({ where: { slug: "valorant" } }),
    ]);
    sellerId = seller.id;
    sellerCookie = `${env.AUTH_COOKIE_NAME}=${app.jwt.sign({ role: "SELLER" }, { sub: seller.id })}`;
    otherSellerCookie = `${env.AUTH_COOKIE_NAME}=${app.jwt.sign({ role: "SELLER" }, { sub: other.id })}`;
    listingId = (await prisma.listing.create({
      data: {
        sellerId,
        categoryId: accounts.id,
        gameId: valorant.id,
        title: "Valorant inventory analysis listing",
        description: "A complete account listing prepared for inventory analysis tests.",
        price: "120.00",
        media: { create: { role: "COVER", storageKey: `test/${randomUUID()}.png`, mimeType: "image/png", sizeBytes: 10, altText: "Test" } },
      },
    })).id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it("encrypts and decrypts provider secrets with an authenticated envelope", () => {
    const encrypted = encryptSecret("provider-key-value");
    expect(encrypted).not.toContain("provider-key-value");
    expect(decryptSecret(encrypted)).toBe("provider-key-value");
  });

  it("builds the external inference request and job URLs", () => {
    expect(externalInferenceRequestBody("valorant", "https://signed-r2.example/video.mp4")).toEqual({
      game: "valorant",
      media: "https://signed-r2.example/video.mp4",
      mediaType: "video",
    });
    expect(externalInferenceUrl("https://inventory.example/"))
      .toBe("https://inventory.example/api/v1/external/inference");
    expect(externalInferenceUrl("https://inventory.example", "job-id"))
      .toBe("https://inventory.example/api/v1/external/inference/job-id");
  });

  it("keeps useful external inference failure details", () => {
    expect(externalInferenceFailureMessage({ status: "failed", error: "Video decoder could not read the file." }))
      .toBe("Video decoder could not read the file.");
    expect(externalInferenceFailureMessage({ status: "failed", detail: { code: "MODEL_ERROR" } }))
      .toBe('{"code":"MODEL_ERROR"}');
  });

  it("reports eligibility but blocks analysis until Admin configures the provider", async () => {
    const overview = await app.inject({
      method: "GET",
      url: `/api/v1/inventory-analyses/listings/${listingId}`,
      headers: { cookie: sellerCookie },
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().data).toMatchObject({
      eligible: true,
      integrationConfigured: false,
      maxSizeBytes: 157_286_400,
      retentionMinutes: 120,
    });

    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/inventory-analyses/upload-url",
      headers: { cookie: sellerCookie },
      payload: { listingId, fileName: "inventory.mp4", contentType: "video/mp4", sizeBytes: 1024 },
    });
    expect(upload.statusCode).toBe(409);
    expect(upload.json().error.code).toBe("INVENTORY_ANALYSIS_DISABLED");
  });

  it("enforces ownership and the exact 150 MB request limit", async () => {
    const forbidden = await app.inject({
      method: "GET",
      url: `/api/v1/inventory-analyses/listings/${listingId}`,
      headers: { cookie: otherSellerCookie },
    });
    expect(forbidden.statusCode).toBe(403);

    const tooLarge = await app.inject({
      method: "POST",
      url: "/api/v1/inventory-analyses/upload-url",
      headers: { cookie: sellerCookie },
      payload: {
        listingId,
        fileName: "inventory.mp4",
        contentType: "video/mp4",
        sizeBytes: 157_286_401,
      },
    });
    expect(tooLarge.statusCode).toBe(400);
  });
});
