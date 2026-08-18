import { ListingCard } from "./listing-card";
import type { ListingSummary } from "./types";

export function ListingGrid({ listings }: { listings: ListingSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
