import type { UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../auth/auth.service.js";
import { removeStoredMediaFiles } from "./listings.media.js";

const testEmailSuffix = "@listings.test.local";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

interface MultipartTestFile {
  fieldName: string;
  filename: string;
  mimeType: string;
  content: Buffer;
}

function multipartPayload(fields: Record<string, string>, files: MultipartTestFile[]) {
  const boundary = `test-${randomUUID()}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  }
  for (const file of files) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
    ));
    chunks.push(file.content, Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    payload: Buffer.concat(chunks),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

function sessionCookie(response: { headers: Record<string, unknown> }) {
  const value = response.headers["set-cookie"];
  const header = Array.isArray(value) ? value[0] : value;
  return typeof header === "string" ? header.split(";", 1)[0] : "";
}

async function createAccount(emailPrefix: string, role: UserRole) {
  const email = `${emailPrefix}${testEmailSuffix}`;
  await prisma.user.create({
    data: {
      name: `${emailPrefix} account`,
      email,
      passwordHash: await hashPassword("Seller123!"),
      role,
      wallet: { create: {} },
    },
  });
  return email;
}

async function login(app: FastifyInstance, email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: "Seller123!" },
  });
  expect(response.statusCode).toBe(200);
  return sessionCookie(response);
}

function listingMultipart(
  categoryId: string,
  gameId: string,
  overrides: Partial<Record<"title" | "description" | "price", string>> = {},
  cover: MultipartTestFile = {
    fieldName: "cover",
    filename: "cover.png",
    mimeType: "image/png",
    content: validPng,
  },
) {
  return multipartPayload(
    {
      categoryId,
      gameId,
      title: overrides.title ?? "Neon Test Listing",
      description: overrides.description ?? "A complete test listing description for the marketplace.",
      price: overrides.price ?? "125.50",
    },
    [cover],
  );
}

async function cleanupTestData() {
  const media = await prisma.listingMedia.findMany({
    where: { listing: { seller: { email: { endsWith: testEmailSuffix } } } },
    select: { storageKey: true },
  });
  await removeStoredMediaFiles(media.map((item) => item.storageKey));
  await prisma.listing.deleteMany({
    where: { seller: { email: { endsWith: testEmailSuffix } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: testEmailSuffix } } });
}

describe("Sprint 2 Listings API", () => {
  let app: FastifyInstance;
  let categoryId: string;
  let gameId: string;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    const category = await prisma.category.upsert({
      where: { slug: "test-skins" },
      update: {},
      create: {
        name: "Test Skins",
        slug: "test-skins",
        description: "Category used by the Listings API integration tests.",
      },
    });
    const game = await prisma.game.upsert({
      where: { slug: "test-arena" },
      update: {},
      create: { name: "Test Arena", slug: "test-arena" },
    });
    categoryId = category.id;
    gameId = game.id;
  });

  beforeEach(cleanupTestData);

  afterAll(async () => {
    await cleanupTestData();
    await prisma.category.deleteMany({ where: { slug: "test-skins" } });
    await prisma.game.deleteMany({ where: { slug: "test-arena" } });
    await app.close();
  });

  it("creates an active listing atomically with its Cover and serves it publicly", async () => {
    const email = await createAccount("owner", "SELLER");
    const cookie = await login(app, email);
    const request = listingMultipart(categoryId, gameId);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/listings",
      headers: { ...request.headers, cookie },
      payload: request.payload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      title: "Neon Test Listing",
      price: "125.50",
      status: "ACTIVE",
      category: { slug: "test-skins" },
      game: { slug: "test-arena" },
      cover: { role: "COVER", mimeType: "image/png" },
      gallery: [],
      video: null,
    });

    const coverPath = new URL(response.json().data.cover.url).pathname;
    const mediaResponse = await app.inject({ method: "GET", url: coverPath });
    expect(mediaResponse.statusCode).toBe(200);
    expect(mediaResponse.headers["content-type"]).toBe("image/png");
    expect(mediaResponse.rawPayload).toEqual(validPng);

    const catalogResponse = await app.inject({
      method: "GET",
      url: "/api/v1/listings?q=complete&category=test-skins&game=test-arena&minPrice=100&maxPrice=130&sort=price_desc&page=1&limit=1",
    });
    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.json().data.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
    expect(catalogResponse.json().data.items[0]).toMatchObject({
      id: response.json().data.id,
      title: "Neon Test Listing",
      cover: { role: "COVER" },
    });
  });

  it("lists the seeded taxonomy using the standard response format", async () => {
    const [categoriesResponse, gamesResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/categories" }),
      app.inject({ method: "GET", url: "/api/v1/games" }),
    ]);

    expect(categoriesResponse.statusCode).toBe(200);
    expect(categoriesResponse.json().data.items).toContainEqual(expect.objectContaining({ slug: "test-skins" }));
    expect(gamesResponse.statusCode).toBe(200);
    expect(gamesResponse.json().data.items).toContainEqual(expect.objectContaining({ slug: "test-arena" }));
  });

  it("enforces ownership for update, deactivate and media upload", async () => {
    const ownerEmail = await createAccount("listing-owner", "SELLER");
    const otherEmail = await createAccount("other-seller", "SELLER");
    const ownerCookie = await login(app, ownerEmail);
    const otherCookie = await login(app, otherEmail);
    const createRequest = listingMultipart(categoryId, gameId);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/listings",
      headers: { ...createRequest.headers, cookie: ownerCookie },
      payload: createRequest.payload,
    });
    const listingId = createResponse.json().data.id as string;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/listings/${listingId}`,
      headers: { cookie: otherCookie },
      payload: {
        categoryId,
        gameId,
        title: "Changed by another Seller",
        description: "Another Seller must not be able to update this listing.",
        price: "150.00",
      },
    });
    const deactivateResponse = await app.inject({
      method: "POST",
      url: `/api/v1/listings/${listingId}/deactivate`,
      headers: { cookie: otherCookie },
    });
    const uploadRequest = multipartPayload(
      { role: "GALLERY" },
      [{ fieldName: "file", filename: "gallery.png", mimeType: "image/png", content: validPng }],
    );
    const uploadResponse = await app.inject({
      method: "POST",
      url: `/api/v1/listings/${listingId}/media`,
      headers: { ...uploadRequest.headers, cookie: otherCookie },
      payload: uploadRequest.payload,
    });

    expect(updateResponse.statusCode).toBe(403);
    expect(updateResponse.json().error.code).toBe("FORBIDDEN");
    expect(deactivateResponse.statusCode).toBe(403);
    expect(uploadResponse.statusCode).toBe(403);

    const ownerUpdate = await app.inject({
      method: "PATCH",
      url: `/api/v1/listings/${listingId}`,
      headers: { cookie: ownerCookie },
      payload: {
        categoryId,
        gameId: null,
        title: "Owner Updated Listing",
        description: "The owning Seller can update all editable listing fields.",
        price: "175.00",
      },
    });
    const ownerDeactivate = await app.inject({
      method: "POST",
      url: `/api/v1/listings/${listingId}/deactivate`,
      headers: { cookie: ownerCookie },
    });
    const publicList = await app.inject({ method: "GET", url: "/api/v1/listings?category=test-skins" });
    const publicDetail = await app.inject({ method: "GET", url: `/api/v1/listings/${listingId}` });
    const ownerDetail = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listingId}`,
      headers: { cookie: ownerCookie },
    });
    const mine = await app.inject({
      method: "GET",
      url: "/api/v1/listings/mine",
      headers: { cookie: ownerCookie },
    });

    expect(ownerUpdate.statusCode).toBe(200);
    expect(ownerUpdate.json().data).toMatchObject({
      title: "Owner Updated Listing",
      price: "175.00",
      game: null,
    });
    expect(ownerDeactivate.statusCode).toBe(200);
    expect(ownerDeactivate.json().data.status).toBe("INACTIVE");
    expect(publicList.json().data.pagination.total).toBe(0);
    expect(publicDetail.statusCode).toBe(404);
    expect(ownerDetail.statusCode).toBe(200);
    expect(mine.json().data.items).toContainEqual(expect.objectContaining({ id: listingId, status: "INACTIVE" }));
  });

  it("uploads gallery and optional video media while cards keep Cover-only payloads", async () => {
    const email = await createAccount("media-owner", "SELLER");
    const cookie = await login(app, email);
    const createRequest = listingMultipart(categoryId, gameId);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/listings",
      headers: { ...createRequest.headers, cookie },
      payload: createRequest.payload,
    });
    const listingId = createResponse.json().data.id as string;

    const galleryRequest = multipartPayload(
      { role: "GALLERY" },
      [{ fieldName: "file", filename: "gallery.png", mimeType: "image/png", content: validPng }],
    );
    const galleryResponse = await app.inject({
      method: "POST",
      url: `/api/v1/listings/${listingId}/media`,
      headers: { ...galleryRequest.headers, cookie },
      payload: galleryRequest.payload,
    });
    const videoRequest = multipartPayload(
      { role: "VIDEO" },
      [{
        fieldName: "file",
        filename: "preview.webm",
        mimeType: "video/webm",
        content: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]),
      }],
    );
    const videoResponse = await app.inject({
      method: "POST",
      url: `/api/v1/listings/${listingId}/media`,
      headers: { ...videoRequest.headers, cookie },
      payload: videoRequest.payload,
    });
    const detailResponse = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listingId}`,
    });
    const pageResponse = await app.inject({
      method: "GET",
      url: "/api/v1/listings?category=test-skins",
    });

    expect(galleryResponse.statusCode).toBe(201);
    expect(galleryResponse.json().data.role).toBe("GALLERY");
    expect(videoResponse.statusCode).toBe(201);
    expect(videoResponse.json().data).toMatchObject({ role: "VIDEO", mimeType: "video/webm" });
    expect(detailResponse.json().data.gallery).toHaveLength(1);
    expect(detailResponse.json().data.video).toMatchObject({ role: "VIDEO" });
    expect(pageResponse.json().data.items[0]).not.toHaveProperty("gallery");
    expect(pageResponse.json().data.items[0]).not.toHaveProperty("video");
  });

  it("rejects spoofed media content without creating a partial listing", async () => {
    const email = await createAccount("invalid-media", "SELLER");
    const cookie = await login(app, email);
    const request = listingMultipart(categoryId, gameId, {}, {
      fieldName: "cover",
      filename: "spoofed.png",
      mimeType: "image/png",
      content: Buffer.from("not actually a png"),
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/listings",
      headers: { ...request.headers, cookie },
      payload: request.payload,
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe("INVALID_MEDIA_CONTENT");
    expect(await prisma.listing.count({
      where: { seller: { email } },
    })).toBe(0);
  });

  it("rejects invalid price ranges without querying a broader result set", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings?minPrice=200.00&maxPrice=100.00",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_PRICE_RANGE");
  });
});
