import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PackageSearch, Search, ShieldCheck, Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { CategoryTile } from "../features/listings/category-tile";
import { listCategories, listListings } from "../features/listings/listings-api";
import { ListingGrid } from "../features/listings/listing-grid";
import { MarketplaceState } from "../features/listings/marketplace-state";
import { listingKeys } from "../features/listings/types";
import { useAuthStore } from "../store/auth-store";

export function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const session = useAuthStore((state) => state.session);
  const categoriesQuery = useQuery({ queryKey: listingKeys.categories, queryFn: listCategories });
  const listingsQuery = useQuery({
    queryKey: listingKeys.page({ sort: "newest", limit: 6 }),
    queryFn: () => listListings({ sort: "newest", limit: 6 }),
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    navigate(value ? `/listings?q=${encodeURIComponent(value)}` : "/listings");
  }

  return (
    <div>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8 lg:py-12">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-700">Player marketplace</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-normal text-gray-950 sm:text-4xl">
              Find the exact gaming item you need.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
              Browse active account, currency, item, skin, gift card and boosting listings from marketplace Sellers.
            </p>
            <form className="mt-6 flex max-w-2xl gap-2" onSubmit={submitSearch} role="search">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search marketplace</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <Input className="h-11 pl-10" placeholder="Search listings" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <Button className="h-11" type="submit">Search</Button>
            </form>
          </div>

          <aside className="border-l-4 border-emerald-600 bg-gray-950 p-5 text-white" aria-label="Marketplace status">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <ShieldCheck className="size-5" aria-hidden="true" />Marketplace ready
            </div>
            <p className="mt-4 text-3xl font-bold">{listingsQuery.data?.pagination.total ?? 0}</p>
            <p className="mt-1 text-sm text-gray-300">active listings</p>
            <div className="mt-6 border-t border-gray-700 pt-4">
              {session?.user.role === "SELLER" ? (
                <Button asChild className="w-full bg-white text-gray-950 hover:bg-gray-200">
                  <Link to="/sell/listings/new"><Store className="size-4" aria-hidden="true" />Create listing</Link>
                </Button>
              ) : (
                <p className="text-sm leading-6 text-gray-300">Seller tools become available with a Seller account.</p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8" aria-labelledby="category-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Explore</p>
            <h2 className="mt-1 text-2xl font-bold" id="category-heading">Browse categories</h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/listings">All listings<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </Button>
        </div>

        {categoriesQuery.isPending ? (
          <MarketplaceState kind="loading" title="Loading categories" description="Preparing the marketplace catalog." />
        ) : categoriesQuery.isError ? (
          <MarketplaceState kind="error" title="Categories unavailable" description="The catalog could not be loaded." />
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoriesQuery.data.map((category) => <CategoryTile key={category.id} category={category} />)}
          </div>
        )}
      </section>

      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8" aria-labelledby="latest-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700">Fresh inventory</p>
              <h2 className="mt-1 text-2xl font-bold" id="latest-heading">Latest listings</h2>
            </div>
            <span className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
              <PackageSearch className="size-4" aria-hidden="true" />Latest active inventory
            </span>
          </div>

          <div className="mt-5">
            {listingsQuery.isPending ? (
              <MarketplaceState kind="loading" title="Loading listings" description="Checking the latest active inventory." />
            ) : listingsQuery.isError ? (
              <MarketplaceState kind="error" title="Listings unavailable" description="The latest listings could not be loaded." />
            ) : listingsQuery.data.items.length === 0 ? (
              <MarketplaceState kind="empty" title="No active listings" description="Seller listings will appear here as soon as they are active." />
            ) : (
              <ListingGrid listings={listingsQuery.data.items} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
