import { listingCoverByCategory, mockCategories, mockGames, mockListings } from "./mock-data";
import type {
  CreateListingCommand,
  ListingActor,
  ListingDetail,
  ListingFilters,
  ListingInput,
  ListingMediaInput,
  ListingPage,
  ListingMedia,
  UpdateListingCommand,
} from "./types";

const STORAGE_KEY = "gaming-marketplace.mock-listings.v1";
const runtimeObjectUrls = new Set<string>();

const wait = (milliseconds = 180) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function readStoredListings() {
  if (typeof window === "undefined") return [] as ListingDetail[];

  try {
    const listings = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as ListingDetail[];
    return listings.map((listing) => ({
      ...listing,
      cover: staleObjectUrl(listing.cover.url)
        ? { ...listing.cover, url: listingCoverByCategory[listing.category.slug] }
        : listing.cover,
      gallery: listing.gallery.filter((media) => !staleObjectUrl(media.url)),
      video: listing.video && staleObjectUrl(listing.video.url) ? null : listing.video,
    }));
  } catch {
    return [] as ListingDetail[];
  }
}

function staleObjectUrl(url: string) {
  return url.startsWith("blob:") && !runtimeObjectUrls.has(url);
}

function writeStoredListings(listings: ListingDetail[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
  }
}

function allListings() {
  const stored = readStoredListings();
  const storedIds = new Set(stored.map((listing) => listing.id));
  return [...stored, ...mockListings.filter((listing) => !storedIds.has(listing.id))];
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `listing-${Date.now()}`;
}

export function isListingOwner(listing: ListingDetail, actor: ListingActor) {
  return (
    listing.seller.id === actor.id ||
    (listing.seller.id === "demo-seller" && actor.email.toLowerCase() === "seller@gaming.local")
  );
}

function assertOwner(listing: ListingDetail, actor: ListingActor) {
  if (!isListingOwner(listing, actor)) {
    throw new Error("You can only manage listings that belong to your Seller account.");
  }
}

function mediaFromFile(file: File, role: ListingMedia["role"], id: string, alt: string): ListingMedia | null {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(file);
  runtimeObjectUrls.add(url);
  return { id, role, url, alt, mimeType: file.type };
}

function listingFromInput(
  input: ListingInput,
  media: ListingMediaInput,
  actor: ListingActor,
  existing?: ListingDetail,
): ListingDetail {
  const category = mockCategories.find((item) => item.id === input.categoryId);
  const game = input.gameId ? mockGames.find((item) => item.id === input.gameId) ?? null : null;

  if (!category) throw new Error("Choose a valid category.");

  const now = new Date().toISOString();
  const id = existing?.id ?? createId();
  const coverUrl = existing?.cover.url ?? listingCoverByCategory[category.slug];
  const title = input.title.trim();
  const uploadedCover = media.cover
    ? mediaFromFile(media.cover, "COVER", `media-${id}-cover-${Date.now()}`, `${title} cover`)
    : null;
  const uploadedGallery = media.gallery
    .map((file, index) => mediaFromFile(file, "GALLERY", `media-${id}-gallery-${Date.now()}-${index}`, `${title} gallery image ${index + 1}`))
    .filter((item): item is ListingMedia => Boolean(item));
  const uploadedVideo = media.video
    ? mediaFromFile(media.video, "VIDEO", `media-${id}-video-${Date.now()}`, `${title} product video`)
    : null;

  return {
    id,
    title,
    excerpt: input.description.trim().slice(0, 110),
    description: input.description.trim(),
    price: Number(input.price).toFixed(2),
    status: "ACTIVE",
    category,
    game,
    cover: uploadedCover ?? existing?.cover ?? {
      id: `media-${id}-cover`,
      role: "COVER",
      url: coverUrl,
      alt: `${title} cover`,
    },
    gallery: uploadedGallery.length ? uploadedGallery : existing?.gallery ?? [],
    video: uploadedVideo ?? existing?.video ?? null,
    seller: existing?.seller ?? { id: actor.id, name: actor.name, joinedAt: now },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function mockListCategories() {
  await wait(90);
  return mockCategories;
}

export async function mockListGames() {
  await wait(90);
  return mockGames;
}

export async function mockListListings(filters: ListingFilters = {}): Promise<ListingPage> {
  await wait();
  const query = filters.q?.trim().toLowerCase();
  const minimum = filters.minPrice ? Number(filters.minPrice) : null;
  const maximum = filters.maxPrice ? Number(filters.maxPrice) : null;
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 12));

  const filtered = allListings()
    .filter((listing) => listing.status === "ACTIVE")
    .filter((listing) => !query || `${listing.title} ${listing.description}`.toLowerCase().includes(query))
    .filter((listing) => !filters.category || listing.category.slug === filters.category)
    .filter((listing) => !filters.game || listing.game?.slug === filters.game)
    .filter((listing) => minimum === null || Number(listing.price) >= minimum)
    .filter((listing) => maximum === null || Number(listing.price) <= maximum)
    .sort((left, right) => {
      if (filters.sort === "price_asc") return Number(left.price) - Number(right.price);
      if (filters.sort === "price_desc") return Number(right.price) - Number(left.price);
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (page - 1) * limit;

  return {
    items: filtered.slice(start, start + limit),
    pagination: { page, limit, total, totalPages },
  };
}

export async function mockGetListing(listingId: string) {
  await wait();
  const listing = allListings().find((item) => item.id === listingId);
  if (!listing) throw new Error("Listing not found.");
  return listing;
}

export async function mockListMyListings(actor: ListingActor) {
  await wait();
  return allListings().filter((listing) => isListingOwner(listing, actor));
}

export async function mockCreateListing(command: CreateListingCommand) {
  await wait(320);
  const listing = listingFromInput(command.input, command.media, command.actor);
  writeStoredListings([listing, ...readStoredListings()]);
  return listing;
}

export async function mockUpdateListing(command: UpdateListingCommand) {
  await wait(320);
  const current = allListings().find((listing) => listing.id === command.listingId);
  if (!current) throw new Error("Listing not found.");
  assertOwner(current, command.actor);

  const updated = listingFromInput(command.input, command.media, command.actor, current);
  const stored = readStoredListings().filter((listing) => listing.id !== command.listingId);
  writeStoredListings([updated, ...stored]);
  return updated;
}

export async function mockDeactivateListing(listingId: string, actor: ListingActor) {
  await wait(220);
  const current = allListings().find((listing) => listing.id === listingId);
  if (!current) throw new Error("Listing not found.");
  assertOwner(current, actor);

  const updated = { ...current, status: "INACTIVE" as const, updatedAt: new Date().toISOString() };
  const stored = readStoredListings().filter((listing) => listing.id !== listingId);
  writeStoredListings([updated, ...stored]);
  return updated;
}
