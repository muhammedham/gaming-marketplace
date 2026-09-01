import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  PackageSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import heroImage from "../assets/marketplace-hero.jpg";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { CategoryTile } from "../features/listings/category-tile";
import { ListingGrid } from "../features/listings/listing-grid";
import { listCategories, listListings } from "../features/listings/listings-api";
import { MarketplaceState } from "../features/listings/marketplace-state";
import { listingKeys } from "../features/listings/types";
import { useAuthStore } from "../store/auth-store";

export function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const session = useAuthStore((state) => state.session);
  const categoriesQuery = useQuery({
    queryKey: listingKeys.categories,
    queryFn: listCategories,
  });
  const listingsQuery = useQuery({
    queryKey: listingKeys.page({ sort: "newest", limit: 4 }),
    queryFn: () => listListings({ sort: "newest", limit: 4 }),
  });
  const valorantQuery = useQuery({
    queryKey: listingKeys.page({ game: "valorant", sort: "popular", limit: 4 }),
    queryFn: () => listListings({ game: "valorant", sort: "popular", limit: 4 }),
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    navigate(value ? `/listings?q=${encodeURIComponent(value)}` : "/listings");
  }

  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-[#758173]/25">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_right,rgba(145,47,86,0.18),transparent_55%)]" />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)] lg:items-center lg:px-8 lg:py-16">
          <div className="relative min-w-0 overflow-hidden rounded-3xl bg-[#0D2149] shadow-[0_24px_70px_rgba(25,17,2,0.18)]">
            <img
              className="aspect-[16/11] h-full w-full object-cover"
              src={heroImage}
              alt="Original futuristic game-item marketplace scene"
            />
            <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2 sm:inset-x-6 sm:bottom-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#191102]/85 px-3 py-2 text-xs font-semibold text-[#FEF5EF] backdrop-blur">
                <ShieldCheck className="size-4 text-[#758173]" aria-hidden="true" />Protected orders
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#FEF5EF]/90 px-3 py-2 text-xs font-semibold text-[#191102] backdrop-blur">
                <BadgeCheck className="size-4 text-[#912F56]" aria-hidden="true" />Verified flows
              </span>
            </div>
          </div>

          <div className="min-w-0 lg:pl-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#912F56]">
              <Sparkles className="size-4" aria-hidden="true" />Player marketplace
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-[#191102] sm:text-5xl lg:text-6xl">
              Find the exact gaming item you need.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#758173] sm:text-lg">
              Browse active accounts, currency, items, skins, gift cards and boosting listings from marketplace Sellers.
            </p>

            <form className="mt-7 max-w-2xl" onSubmit={submitSearch} role="search">
              <label className="relative block min-w-0">
                <span className="sr-only">Search marketplace</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#758173]" aria-hidden="true" />
                <Input
                  className="h-13 rounded-xl border-[#758173]/40 bg-[#FEF5EF] pl-12 pr-4 shadow-sm"
                  placeholder="Search accounts, skins, currency…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Button className="h-12 flex-1 rounded-xl" type="submit">
                  Search marketplace
                </Button>
                <Button asChild className="h-12 flex-1 rounded-xl" variant="secondary">
                  <Link to="/listings">View all listings<ArrowRight className="size-4" aria-hidden="true" /></Link>
                </Button>
              </div>
            </form>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#758173]">
              <span><strong className="text-lg text-[#191102]">{listingsQuery.data?.pagination.total ?? 0}</strong> active listings</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-[#912F56]" aria-hidden="true" />Held-safe checkout</span>
              {session?.user.role === "SELLER" ? (
                <Link className="inline-flex items-center gap-1.5 font-semibold text-[#912F56] hover:underline" to="/sell/listings/new">
                  <Store className="size-4" aria-hidden="true" />Create a listing
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="category-heading" id="categories">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#912F56]">Explore by type</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight" id="category-heading">Browse categories</h2>
          </div>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/listings">All listings<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </Button>
        </div>

        {categoriesQuery.isPending ? (
          <MarketplaceState kind="loading" title="Loading categories" description="Preparing the marketplace catalog." />
        ) : categoriesQuery.isError ? (
          <MarketplaceState kind="error" title="Categories unavailable" description="The catalog could not be loaded." />
        ) : (
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoriesQuery.data.map((category) => <CategoryTile key={category.id} category={category} />)}
          </div>
        )}
      </section>

      <section className="border-y border-[#758173]/25 bg-[#FEF5EF]" id="latest">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="latest-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#0D2149]">Fresh inventory</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight" id="latest-heading">Latest listings</h2>
            </div>
            <span className="hidden items-center gap-2 text-sm text-[#758173] sm:flex">
              <PackageSearch className="size-4" aria-hidden="true" />Newest active inventory
            </span>
          </div>

          <div className="mt-7">
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

      <section className="bg-[#0D2149] text-[#FEF5EF]" id="valorant-best-sellers">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" aria-labelledby="valorant-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#758173]">
                <TrendingUp className="size-4" aria-hidden="true" />Most purchased
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight" id="valorant-heading">Popular on Valorant</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758173]">
                Valorant listings ordered by marketplace purchase activity, with the most purchased first.
              </p>
            </div>
            <Button asChild className="border border-[#758173]/50 bg-[#FEF5EF] text-[#191102] hover:bg-[#912F56] hover:text-[#FEF5EF]">
              <Link to="/listings?game=valorant">See all Valorant listings<ArrowRight className="size-4" aria-hidden="true" /></Link>
            </Button>
          </div>

          <div className="mt-8 text-[#191102]">
            {valorantQuery.isPending ? (
              <MarketplaceState kind="loading" title="Loading Valorant listings" description="Ranking the most purchased listings." />
            ) : valorantQuery.isError ? (
              <MarketplaceState kind="error" title="Valorant listings unavailable" description="The popular-listing ranking could not be loaded." />
            ) : valorantQuery.data.items.length === 0 ? (
              <div className="rounded-2xl border border-[#758173]/35 bg-[#191102]/25 p-8 text-center text-[#FEF5EF]">
                <p className="font-semibold">No active Valorant listings yet.</p>
                <p className="mt-2 text-sm text-[#758173]">New Seller inventory will appear here automatically.</p>
              </div>
            ) : (
              <ListingGrid listings={valorantQuery.data.items} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
