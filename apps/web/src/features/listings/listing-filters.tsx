import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { Category, Game, ListingFilters, ListingSort } from "./types";

const selectClass =
  "h-10 min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

interface ListingFiltersProps {
  categories: Category[];
  games: Game[];
  value: ListingFilters;
  lockedCategory?: string;
  onApply: (filters: ListingFilters) => void;
}

export function ListingFiltersForm({ categories, games, value, lockedCategory, onApply }: ListingFiltersProps) {
  const [draft, setDraft] = useState<ListingFilters>(value);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({ ...draft, category: lockedCategory ?? draft.category, page: 1 });
  }

  function clear() {
    const next = { sort: "newest" as ListingSort, category: lockedCategory, page: 1 };
    setDraft(next);
    onApply(next);
  }

  return (
    <form className="border-y border-gray-200 bg-white py-4" onSubmit={submit} aria-label="Listing filters">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 sm:px-6 lg:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(120px,1fr))_auto] lg:px-8">
        <label className="relative min-w-0">
          <span className="sr-only">Search listings</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <Input
            className="pl-9"
            placeholder="Search by title"
            value={draft.q ?? ""}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          />
        </label>

        {!lockedCategory ? (
          <label className="min-w-0">
            <span className="sr-only">Category</span>
            <select
              className={`${selectClass} w-full`}
              value={draft.category ?? ""}
              onChange={(event) => setDraft({ ...draft, category: event.target.value || undefined })}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>{category.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="min-w-0">
          <span className="sr-only">Game</span>
          <select
            className={`${selectClass} w-full`}
            value={draft.game ?? ""}
            onChange={(event) => setDraft({ ...draft, game: event.target.value || undefined })}
          >
            <option value="">All games</option>
            {games.map((game) => (
              <option key={game.id} value={game.slug}>{game.name}</option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Minimum price</span>
          <Input
            min="0"
            inputMode="decimal"
            placeholder="Min price"
            type="number"
            value={draft.minPrice ?? ""}
            onChange={(event) => setDraft({ ...draft, minPrice: event.target.value || undefined })}
          />
        </label>

        <label className="min-w-0">
          <span className="sr-only">Maximum price</span>
          <Input
            min="0"
            inputMode="decimal"
            placeholder="Max price"
            type="number"
            value={draft.maxPrice ?? ""}
            onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value || undefined })}
          />
        </label>

        <label className="min-w-0">
          <span className="sr-only">Sort listings</span>
          <select
            className={`${selectClass} w-full`}
            value={draft.sort ?? "newest"}
            onChange={(event) => setDraft({ ...draft, sort: event.target.value as ListingSort })}
          >
            <option value="newest">Newest</option>
            <option value="popular">Most purchased</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>

        <div className="flex gap-2 lg:col-span-full lg:justify-end xl:col-span-1">
          <Button className="flex-1 lg:flex-none" type="submit">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Apply
          </Button>
          <Button size="icon" type="button" variant="ghost" title="Clear filters" aria-label="Clear filters" onClick={clear}>
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </form>
  );
}
