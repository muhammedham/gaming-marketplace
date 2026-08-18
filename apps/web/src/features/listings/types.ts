export type ListingStatus = "ACTIVE" | "INACTIVE";
export type MediaRole = "COVER" | "GALLERY" | "VIDEO";
export type ListingSort = "newest" | "price_asc" | "price_desc";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface Game {
  id: string;
  name: string;
  slug: string;
}

export interface ListingMedia {
  id: string;
  role: MediaRole;
  url: string;
  alt: string;
  mimeType?: string;
}

export interface SellerSummary {
  id: string;
  name: string;
  joinedAt: string;
}

export interface ListingSummary {
  id: string;
  title: string;
  excerpt: string;
  price: string;
  status: ListingStatus;
  category: Category;
  game: Game | null;
  cover: ListingMedia;
  seller: SellerSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ListingDetail extends ListingSummary {
  description: string;
  gallery: ListingMedia[];
  video: ListingMedia | null;
}

export interface ListingFilters {
  q?: string;
  category?: string;
  game?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: ListingSort;
  page?: number;
  limit?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListingPage {
  items: ListingSummary[];
  pagination: Pagination;
}

export interface ListingInput {
  categoryId: string;
  gameId: string | null;
  title: string;
  description: string;
  price: string;
}

export interface ListingMediaInput {
  cover: File | null;
  gallery: File[];
  video: File | null;
}

export interface ListingActor {
  id: string;
  name: string;
  email: string;
}

export interface CreateListingCommand {
  input: ListingInput;
  media: ListingMediaInput;
  actor: ListingActor;
}

export interface UpdateListingCommand extends CreateListingCommand {
  listingId: string;
}

export const listingKeys = {
  all: ["listings"] as const,
  page: (filters: ListingFilters) => ["listings", "page", filters] as const,
  detail: (listingId: string) => ["listings", "detail", listingId] as const,
  mine: (actorId: string) => ["listings", "mine", actorId] as const,
  categories: ["categories"] as const,
  games: ["games"] as const,
};
