import { apiRequest } from "../../lib/api-client";
import {
  mockCreateListing,
  mockDeactivateListing,
  mockGetListing,
  mockListCategories,
  mockListGames,
  mockListListings,
  mockListMyListings,
  mockUpdateListing,
} from "./mock-listings-api";
import type {
  Category,
  CreateListingCommand,
  Game,
  ListingDetail,
  ListingFilters,
  ListingPage,
  ListingSummary,
  MediaRole,
  UpdateListingCommand,
} from "./types";

const useMockSource = (import.meta.env.VITE_LISTINGS_SOURCE ?? "mock") === "mock";

function queryString(filters: ListingFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.game) params.set("game", filters.game);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const value = params.toString();
  return value ? `?${value}` : "";
}

async function uploadMedia(listingId: string, role: MediaRole, file: File) {
  const body = new FormData();
  body.set("role", role);
  body.set("file", file);
  return apiRequest(`/listings/${listingId}/media`, { method: "POST", body });
}

async function uploadCommandMedia(listingId: string, command: CreateListingCommand) {
  if (command.media.cover) await uploadMedia(listingId, "COVER", command.media.cover);
  for (const file of command.media.gallery) await uploadMedia(listingId, "GALLERY", file);
  if (command.media.video) await uploadMedia(listingId, "VIDEO", command.media.video);
}

export function listCategories() {
  return useMockSource
    ? mockListCategories()
    : apiRequest<{ items: Category[] }>("/categories").then((result) => result.items);
}

export function listGames() {
  return useMockSource
    ? mockListGames()
    : apiRequest<{ items: Game[] }>("/games").then((result) => result.items);
}

export function listListings(filters: ListingFilters = {}) {
  return useMockSource
    ? mockListListings(filters)
    : apiRequest<ListingPage>(`/listings${queryString(filters)}`);
}

export function getListing(listingId: string) {
  return useMockSource
    ? mockGetListing(listingId)
    : apiRequest<ListingDetail>(`/listings/${listingId}`);
}

export function listMyListings(command: { actor: CreateListingCommand["actor"] }) {
  return useMockSource
    ? mockListMyListings(command.actor)
    : apiRequest<{ items: ListingSummary[] }>("/listings/mine").then((result) => result.items);
}

export async function createListing(command: CreateListingCommand) {
  if (useMockSource) return mockCreateListing(command);

  const created = await apiRequest<ListingDetail>("/listings", {
    method: "POST",
    body: JSON.stringify(command.input),
  });
  await uploadCommandMedia(created.id, command);
  return getListing(created.id);
}

export async function updateListing(command: UpdateListingCommand) {
  if (useMockSource) return mockUpdateListing(command);

  const updated = await apiRequest<ListingDetail>(`/listings/${command.listingId}`, {
    method: "PATCH",
    body: JSON.stringify(command.input),
  });
  await uploadCommandMedia(updated.id, command);
  return getListing(updated.id);
}

export function deactivateListing(command: { listingId: string; actor: CreateListingCommand["actor"] }) {
  return useMockSource
    ? mockDeactivateListing(command.listingId, command.actor)
    : apiRequest<ListingDetail>(`/listings/${command.listingId}/deactivate`, { method: "POST" });
}
