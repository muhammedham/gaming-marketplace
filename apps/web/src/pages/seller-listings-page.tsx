import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Eye, Pencil, Power } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { deactivateListing, listMyListings } from "../features/listings/listings-api";
import { MarketplaceState } from "../features/listings/marketplace-state";
import { listingKeys, type ListingActor } from "../features/listings/types";
import { useAuthStore } from "../store/auth-store";

export function SellerListingsPage() {
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session)!;
  const actor: ListingActor = { id: session.user.id, name: session.user.name, email: session.user.email };
  const listingsQuery = useQuery({
    queryKey: listingKeys.mine(actor.id),
    queryFn: () => listMyListings({ actor }),
  });
  const deactivateMutation = useMutation({
    mutationFn: (listingId: string) => deactivateListing({ listingId, actor }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listingKeys.all });
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Seller workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal">My listings</h1>
          <p className="mt-2 text-sm text-gray-500">Create, review and deactivate your marketplace inventory.</p>
        </div>
        <Button asChild><Link to="/sell/listings/new"><CirclePlus className="size-4" aria-hidden="true" />Create listing</Link></Button>
      </header>

      <section className="py-7" aria-label="Seller listings">
        {listingsQuery.isPending ? (
          <MarketplaceState kind="loading" title="Loading your listings" description="Preparing your Seller inventory." />
        ) : listingsQuery.isError ? (
          <MarketplaceState kind="error" title="Listings unavailable" description="Your Seller inventory could not be loaded." />
        ) : listingsQuery.data.length === 0 ? (
          <MarketplaceState kind="empty" title="No listings yet" description="Create your first listing to publish it in the marketplace." action={<Button asChild><Link to="/sell/listings/new">Create listing</Link></Button>} />
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-200">
              {listingsQuery.data.map((listing) => (
                <li className="grid gap-4 p-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center" key={listing.id}>
                  <img className="aspect-[3/2] w-24 rounded-md object-cover" src={listing.cover.url} alt={listing.cover.alt} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-gray-950">{listing.title}</h2>
                      <span className={listing.status === "ACTIVE" ? "rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800" : "rounded-md bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700"}>{listing.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{listing.category.name}{listing.game ? ` / ${listing.game.name}` : ""}</p>
                    <p className="mt-1 text-sm font-semibold">{listing.price} Coin</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    <Button asChild size="icon" variant="ghost" title="View listing"><Link aria-label={`View ${listing.title}`} to={`/listings/${listing.id}`}><Eye className="size-4" aria-hidden="true" /></Link></Button>
                    <Button asChild size="icon" variant="ghost" title="Edit listing"><Link aria-label={`Edit ${listing.title}`} to={`/sell/listings/${listing.id}/edit`}><Pencil className="size-4" aria-hidden="true" /></Link></Button>
                    {listing.status === "ACTIVE" ? (
                      <Button size="icon" variant="ghost" title="Deactivate listing" aria-label={`Deactivate ${listing.title}`} disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(listing.id)}>
                        <Power className="size-4 text-red-700" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {deactivateMutation.isError ? <p className="mt-4 text-sm text-red-700">{deactivateMutation.error.message}</p> : null}
      </section>
    </div>
  );
}
