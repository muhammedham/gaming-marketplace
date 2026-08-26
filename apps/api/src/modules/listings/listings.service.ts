import {
  ListingMediaRole,
  ListingStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import { mediaUrl } from "../../config/uploads.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { ListingBody, ListingQuery } from "./listings.schemas.js";

const listingInclude = {
  category: true,
  game: true,
  seller: { select: { id: true, name: true, createdAt: true } },
  media: { orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
} satisfies Prisma.ListingInclude;

type ListingRecord = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

export interface StoredMediaInput {
  role: ListingMediaRole;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  altText: string;
  sortOrder: number;
}

function toMedia(media: ListingRecord["media"][number]) {
  return {
    id: media.id,
    role: media.role,
    url: mediaUrl(media.storageKey),
    alt: media.altText,
    mimeType: media.mimeType,
  };
}

function requiredCover(listing: ListingRecord) {
  const cover = listing.media.find((media) => media.role === ListingMediaRole.COVER);

  if (!cover) {
    throw new AppError(500, "LISTING_COVER_MISSING", "The listing Cover media is missing.");
  }

  return cover;
}

export function toListingSummary(listing: ListingRecord) {
  return {
    id: listing.id,
    title: listing.title,
    excerpt: listing.description.slice(0, 110),
    price: listing.price.toFixed(2),
    status: listing.status,
    category: {
      id: listing.category.id,
      name: listing.category.name,
      slug: listing.category.slug,
      description: listing.category.description,
    },
    game: listing.game
      ? { id: listing.game.id, name: listing.game.name, slug: listing.game.slug }
      : null,
    cover: toMedia(requiredCover(listing)),
    seller: {
      id: listing.seller.id,
      name: listing.seller.name,
      joinedAt: listing.seller.createdAt.toISOString(),
    },
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export function toListingDetail(listing: ListingRecord) {
  return {
    ...toListingSummary(listing),
    description: listing.description,
    gallery: listing.media
      .filter((media) => media.role === ListingMediaRole.GALLERY)
      .map(toMedia),
    video: listing.media.find((media) => media.role === ListingMediaRole.VIDEO)
      ? toMedia(listing.media.find((media) => media.role === ListingMediaRole.VIDEO)!)
      : null,
  };
}

function normalizeListingBody(input: ListingBody) {
  const title = input.title.trim();
  const description = input.description.trim();
  const details: Record<string, string[]> = {};

  if (title.length < 3) {
    details.title = ["Title must contain at least 3 non-whitespace characters."];
  }
  if (description.length < 20) {
    details.description = ["Description must contain at least 20 non-whitespace characters."];
  }

  const price = new Prisma.Decimal(input.price);
  if (price.lessThanOrEqualTo(0)) {
    details.price = ["Price must be greater than zero."];
  }

  if (Object.keys(details).length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", details);
  }

  return { ...input, title, description, price };
}

async function assertTaxonomy(
  client: Prisma.TransactionClient | typeof prisma,
  categoryId: string,
  gameId: string | null,
) {
  const [category, game] = await Promise.all([
    client.category.findUnique({ where: { id: categoryId }, select: { id: true } }),
    gameId
      ? client.game.findUnique({ where: { id: gameId }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  if (!category) {
    throw new AppError(400, "INVALID_CATEGORY", "Choose a valid category.", {
      categoryId: ["Category does not exist."],
    });
  }
  if (gameId && !game) {
    throw new AppError(400, "INVALID_GAME", "Choose a valid game.", {
      gameId: ["Game does not exist."],
    });
  }
}

async function ownedListing(
  client: Prisma.TransactionClient | typeof prisma,
  listingId: string,
  sellerId: string,
) {
  const listing = await client.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, title: true },
  });

  if (!listing) {
    throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found.");
  }
  if (listing.sellerId !== sellerId) {
    throw new AppError(403, "FORBIDDEN", "You can only manage your own listings.");
  }

  return listing;
}

export async function assertListingOwner(listingId: string, sellerId: string) {
  return ownedListing(prisma, listingId, sellerId);
}

export async function listListings(query: ListingQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 12;
  const minimum = query.minPrice ? new Prisma.Decimal(query.minPrice) : undefined;
  const maximum = query.maxPrice ? new Prisma.Decimal(query.maxPrice) : undefined;

  if (minimum && maximum && minimum.greaterThan(maximum)) {
    throw new AppError(400, "INVALID_PRICE_RANGE", "Minimum price cannot exceed maximum price.", {
      minPrice: ["Minimum price must be less than or equal to maximum price."],
    });
  }

  const search = query.q?.trim();
  const where: Prisma.ListingWhereInput = {
    status: ListingStatus.ACTIVE,
    media: { some: { role: ListingMediaRole.COVER } },
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.game ? { game: { slug: query.game } } : {}),
    ...(minimum || maximum
      ? { price: { ...(minimum ? { gte: minimum } : {}), ...(maximum ? { lte: maximum } : {}) } }
      : {}),
  };

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    query.sort === "price_asc"
      ? [{ price: "asc" }, { createdAt: "desc" }, { id: "desc" }]
      : query.sort === "price_desc"
        ? [{ price: "desc" }, { createdAt: "desc" }, { id: "desc" }]
        : [{ createdAt: "desc" }, { id: "desc" }];

  const [items, total] = await prisma.$transaction([
    prisma.listing.findMany({
      where,
      include: listingInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    items: items.map(toListingSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getListing(listingId: string, viewerId?: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: listingInclude,
  });

  if (!listing || (listing.status === ListingStatus.INACTIVE && listing.sellerId !== viewerId)) {
    throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found.");
  }

  return toListingDetail(listing);
}

export async function listSellerListings(sellerId: string) {
  const listings = await prisma.listing.findMany({
    where: { sellerId },
    include: listingInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return listings.map(toListingSummary);
}

export async function createListingWithMedia(
  sellerId: string,
  listingId: string,
  input: ListingBody,
  media: StoredMediaInput[],
) {
  const normalized = normalizeListingBody(input);
  const covers = media.filter((item) => item.role === ListingMediaRole.COVER);
  const gallery = media.filter((item) => item.role === ListingMediaRole.GALLERY);
  const videos = media.filter((item) => item.role === ListingMediaRole.VIDEO);

  if (covers.length !== 1 || gallery.length > 5 || videos.length > 1) {
    throw new AppError(400, "INVALID_MEDIA_SET", "The listing media set is invalid.");
  }

  const listing = await prisma.$transaction(async (tx) => {
    await assertTaxonomy(tx, normalized.categoryId, normalized.gameId);
    const seller = await tx.user.findUnique({
      where: { id: sellerId },
      select: { role: true },
    });
    if (!seller || seller.role !== UserRole.SELLER) {
      throw new AppError(403, "FORBIDDEN", "Only Seller accounts can create listings.");
    }

    return tx.listing.create({
      data: {
        id: listingId,
        sellerId,
        categoryId: normalized.categoryId,
        gameId: normalized.gameId,
        title: normalized.title,
        description: normalized.description,
        price: normalized.price,
        status: ListingStatus.ACTIVE,
        media: { create: media },
      },
      include: listingInclude,
    });
  });

  return toListingDetail(listing);
}

export async function updateListing(listingId: string, sellerId: string, input: ListingBody) {
  const normalized = normalizeListingBody(input);

  const listing = await prisma.$transaction(async (tx) => {
    await ownedListing(tx, listingId, sellerId);
    await assertTaxonomy(tx, normalized.categoryId, normalized.gameId);

    return tx.listing.update({
      where: { id: listingId },
      data: {
        categoryId: normalized.categoryId,
        gameId: normalized.gameId,
        title: normalized.title,
        description: normalized.description,
        price: normalized.price,
      },
      include: listingInclude,
    });
  });

  return toListingDetail(listing);
}

export async function deactivateListing(listingId: string, sellerId: string) {
  const listing = await prisma.$transaction(async (tx) => {
    await ownedListing(tx, listingId, sellerId);
    return tx.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.INACTIVE },
      include: listingInclude,
    });
  });

  return toListingDetail(listing);
}

export async function activateListing(listingId: string, sellerId: string) {
  const listing = await prisma.$transaction(async (tx) => {
    await ownedListing(tx, listingId, sellerId);
    return tx.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.ACTIVE },
      include: listingInclude,
    });
  });

  return toListingDetail(listing);
}

export async function addListingMedia(
  listingId: string,
  sellerId: string,
  input: StoredMediaInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "listings" WHERE "id" = ${listingId}::uuid FOR UPDATE
    `);
    await ownedListing(tx, listingId, sellerId);

    const existing = await tx.listingMedia.findMany({
      where: { listingId, role: input.role },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    if (input.role === ListingMediaRole.GALLERY && existing.length >= 5) {
      throw new AppError(409, "GALLERY_LIMIT_REACHED", "A listing can contain up to 5 gallery images.");
    }

    const replacedStorageKeys =
      input.role === ListingMediaRole.GALLERY ? [] : existing.map((media) => media.storageKey);

    if (replacedStorageKeys.length > 0) {
      await tx.listingMedia.deleteMany({
        where: { listingId, role: input.role },
      });
    }

    const media = await tx.listingMedia.create({
      data: {
        ...input,
        listingId,
        sortOrder:
          input.role === ListingMediaRole.GALLERY
            ? Math.max(-1, ...existing.map((item) => item.sortOrder)) + 1
            : 0,
      },
    });

    return { media: toMedia(media), replacedStorageKeys };
  });
}
