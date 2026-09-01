import { Clock3, Gamepad2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { ListingSummary } from "./types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export function ListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-[#758173]/30 bg-[#FEF5EF] transition duration-200 hover:-translate-y-1 hover:border-[#912F56] hover:shadow-xl">
      <Link className="block" to={`/listings/${listing.id}`}>
        <div className="aspect-[3/2] overflow-hidden bg-[#758173]/15">
          <img
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            src={listing.cover.url}
            alt={listing.cover.alt}
          />
        </div>
        <div className="p-4">
          <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-gray-500">
            <span className="truncate font-semibold uppercase text-[#912F56]">{listing.category.name}</span>
            <span className="flex shrink-0 items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {formatDate(listing.createdAt)}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-semibold leading-6 text-gray-950">
            {listing.title}
          </h3>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-gray-500">{listing.excerpt}</p>
          <div className="mt-4 flex min-w-0 items-end justify-between gap-3 border-t border-gray-100 pt-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Seller</p>
              <p className="truncate text-sm font-medium text-gray-800">{listing.seller.name}</p>
            </div>
            <p className="shrink-0 text-lg font-bold text-gray-950">{listing.price} Coin</p>
          </div>
          {listing.game ? (
            <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-gray-500">
              <Gamepad2 className="size-3.5 shrink-0" aria-hidden="true" />
              {listing.game.name}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
