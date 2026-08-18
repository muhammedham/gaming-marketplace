import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Gamepad2, Pencil, ShieldCheck, Store, Tag, UserRound, Video } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { deactivateListing, getListing } from "../features/listings/listings-api";
import { isListingOwner } from "../features/listings/mock-listings-api";
import { MarketplaceState } from "../features/listings/marketplace-state";
import { listingKeys, type ListingActor } from "../features/listings/types";
import { useAuthStore } from "../store/auth-store";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export function ListingDetailPage() {
  const { listingId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const listingQuery = useQuery({
    queryKey: listingKeys.detail(listingId),
    queryFn: () => getListing(listingId),
    enabled: Boolean(listingId),
  });
  const actor: ListingActor | null = session
    ? { id: session.user.id, name: session.user.name, email: session.user.email }
    : null;
  const canManage = Boolean(
    listingQuery.data && actor && session?.user.role === "SELLER" && isListingOwner(listingQuery.data, actor),
  );
  const deactivateMutation = useMutation({
    mutationFn: () => deactivateListing({ listingId, actor: actor! }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listingKeys.all });
      navigate("/sell/listings");
    },
  });

  if (listingQuery.isPending) {
    return <MarketplaceState kind="loading" title="Loading listing" description="Retrieving the listing details and media." />;
  }

  if (listingQuery.isError) {
    return <MarketplaceState kind="error" title="Listing unavailable" description="This listing does not exist or could not be loaded." />;
  }

  const listing = listingQuery.data;
  const images = [listing.cover, ...listing.gallery];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-5 text-sm text-gray-500" aria-label="Breadcrumb">
        <Link className="hover:text-gray-950" to="/listings">Listings</Link>
        <span aria-hidden="true"> / </span>
        <Link className="hover:text-gray-950" to={`/categories/${listing.category.slug}`}>{listing.category.name}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <section className="min-w-0" aria-label="Listing media">
          <div className="aspect-[4/3] overflow-hidden rounded-md border border-gray-200 bg-white">
            <img className="h-full w-full object-cover" src={listing.cover.url} alt={listing.cover.alt} />
          </div>
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {images.map((image) => (
                <div className="aspect-square overflow-hidden rounded-md border border-gray-200 bg-white" key={image.id}>
                  <img className="h-full w-full object-cover" src={image.url} alt={image.alt} />
                </div>
              ))}
            </div>
          ) : null}
          {listing.video ? (
            <div className="mt-4 overflow-hidden rounded-md border border-gray-200 bg-black">
              <video className="aspect-video w-full" controls preload="metadata" src={listing.video.url}>
                <track kind="captions" />
              </video>
            </div>
          ) : null}
        </section>

        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">{listing.status}</span>
            <span className="text-emerald-700">{listing.category.name}</span>
          </div>
          <h1 className="mt-3 break-words text-3xl font-bold tracking-normal text-gray-950">{listing.title}</h1>
          <p className="mt-4 text-3xl font-bold text-gray-950">{listing.price} Coin</p>

          <dl className="mt-6 divide-y divide-gray-200 border-y border-gray-200 text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-gray-500"><Store className="size-4" aria-hidden="true" />Seller</dt>
              <dd className="font-semibold text-gray-950">{listing.seller.name}</dd>
            </div>
            {listing.game ? (
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="flex items-center gap-2 text-gray-500"><Gamepad2 className="size-4" aria-hidden="true" />Game</dt>
                <dd className="font-semibold text-gray-950">{listing.game.name}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-gray-500"><CalendarDays className="size-4" aria-hidden="true" />Published</dt>
              <dd className="font-semibold text-gray-950">{formatDate(listing.createdAt)}</dd>
            </div>
          </dl>

          <div className="mt-7">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Tag className="size-5 text-emerald-700" aria-hidden="true" />Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">{listing.description}</p>
          </div>

          <aside className="mt-7 rounded-md border border-gray-200 bg-white p-4" aria-label="Seller assurance">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-emerald-700" aria-hidden="true" />Seller profile</div>
            <p className="mt-2 flex items-center gap-2 text-sm text-gray-600"><UserRound className="size-4" aria-hidden="true" />Member since {formatDate(listing.seller.joinedAt)}</p>
            {listing.video ? <p className="mt-2 flex items-center gap-2 text-sm text-gray-600"><Video className="size-4" aria-hidden="true" />Product video included</p> : null}
          </aside>

          {canManage ? (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-5">
              <Button asChild><Link to={`/sell/listings/${listing.id}/edit`}><Pencil className="size-4" aria-hidden="true" />Edit listing</Link></Button>
              {listing.status === "ACTIVE" ? (
                <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate()}>
                  {deactivateMutation.isPending ? "Deactivating..." : "Deactivate"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {deactivateMutation.isError ? <p className="mt-3 text-sm text-red-700">{deactivateMutation.error.message}</p> : null}
        </section>
      </div>
    </div>
  );
}
