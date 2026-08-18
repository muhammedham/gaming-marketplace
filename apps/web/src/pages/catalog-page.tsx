import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { ListingFiltersForm } from "../features/listings/listing-filters";
import { listCategories, listGames, listListings } from "../features/listings/listings-api";
import { ListingGrid } from "../features/listings/listing-grid";
import { MarketplaceState } from "../features/listings/marketplace-state";
import { listingKeys, type ListingFilters, type ListingSort } from "../features/listings/types";

function filtersFromParams(params: URLSearchParams, category?: string): ListingFilters {
  const page = Number(params.get("page") ?? "1");
  const sort = params.get("sort");
  return {
    q: params.get("q") || undefined,
    category: category ?? params.get("category") ?? undefined,
    game: params.get("game") || undefined,
    minPrice: params.get("minPrice") || undefined,
    maxPrice: params.get("maxPrice") || undefined,
    sort: sort === "price_asc" || sort === "price_desc" ? sort : ("newest" as ListingSort),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: 12,
  };
}

function paramsFromFilters(filters: ListingFilters, lockedCategory?: string) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category && !lockedCategory) params.set("category", filters.category);
  if (filters.game) params.set("game", filters.game);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if ((filters.page ?? 1) > 1) params.set("page", String(filters.page));
  return params;
}

export function CatalogPage({ categoryMode = false }: { categoryMode?: boolean }) {
  const { categorySlug } = useParams();
  const lockedCategory = categoryMode ? categorySlug : undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams, lockedCategory), [searchParams, lockedCategory]);
  const categoriesQuery = useQuery({ queryKey: listingKeys.categories, queryFn: listCategories });
  const gamesQuery = useQuery({ queryKey: listingKeys.games, queryFn: listGames });
  const listingsQuery = useQuery({
    queryKey: listingKeys.page(filters),
    queryFn: () => listListings(filters),
  });
  const currentCategory = categoriesQuery.data?.find((category) => category.slug === lockedCategory);

  function apply(next: ListingFilters) {
    setSearchParams(paramsFromFilters(next, lockedCategory));
  }

  function movePage(page: number) {
    apply({ ...filters, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const title = currentCategory?.name ?? (categoryMode ? "Category" : "All listings");
  const description = currentCategory?.description ?? "Search and compare active marketplace inventory.";

  return (
    <div>
      <section className="border-b border-gray-200 bg-gray-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-emerald-300">Marketplace catalog</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">{description}</p>
        </div>
      </section>

      <ListingFiltersForm
        key={searchParams.toString()}
        categories={categoriesQuery.data ?? []}
        games={gamesQuery.data ?? []}
        value={filters}
        lockedCategory={lockedCategory}
        onApply={apply}
      />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" aria-label="Listing results">
        {listingsQuery.isPending ? (
          <MarketplaceState kind="loading" title="Loading listings" description="Applying your marketplace filters." />
        ) : listingsQuery.isError ? (
          <MarketplaceState kind="error" title="Listings unavailable" description="The catalog request could not be completed." />
        ) : listingsQuery.data.items.length === 0 ? (
          <MarketplaceState
            kind="empty"
            title="No matching listings"
            description="Try a broader search, another category, or a different price range."
            action={<Button variant="secondary" onClick={() => apply({ category: lockedCategory, sort: "newest", page: 1 })}>Clear filters</Button>}
          />
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500"><span className="font-semibold text-gray-950">{listingsQuery.data.pagination.total}</span> listings</p>
              <p className="text-sm text-gray-500">Page {listingsQuery.data.pagination.page} of {listingsQuery.data.pagination.totalPages}</p>
            </div>
            <ListingGrid listings={listingsQuery.data.items} />
            {listingsQuery.data.pagination.totalPages > 1 ? (
              <div className="mt-8 flex justify-center gap-2" aria-label="Pagination">
                <Button size="icon" variant="secondary" title="Previous page" aria-label="Previous page" disabled={listingsQuery.data.pagination.page <= 1} onClick={() => movePage(listingsQuery.data.pagination.page - 1)}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button size="icon" variant="secondary" title="Next page" aria-label="Next page" disabled={listingsQuery.data.pagination.page >= listingsQuery.data.pagination.totalPages} onClick={() => movePage(listingsQuery.data.pagination.page + 1)}>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
