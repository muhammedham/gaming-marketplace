import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Save, Upload, Video } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { activateListing, createListing, getListing, listCategories, listGames, updateListing } from "../features/listings/listings-api";
import { validateCover, validateGallery, validateVideo } from "../features/listings/media-validation";
import { isListingOwner } from "../features/listings/mock-listings-api";
import { MarketplaceState } from "../features/listings/marketplace-state";
import { listingKeys, type ListingActor, type ListingDetail, type ListingInput } from "../features/listings/types";
import { useAuthStore } from "../store/auth-store";

const emptyInput: ListingInput = { categoryId: "", gameId: null, title: "", description: "", price: "" };
const fieldClass = "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100";

function ListingEditor({ actor, existing }: { actor: ListingActor; existing?: ListingDetail }) {
  const editing = Boolean(existing);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState<ListingInput>(() => existing ? {
    categoryId: existing.category.id,
    gameId: existing.game?.id ?? null,
    title: existing.title,
    description: existing.description,
    price: existing.price,
  } : emptyInput);
  const [cover, setCover] = useState<File | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const categoriesQuery = useQuery({ queryKey: listingKeys.categories, queryFn: listCategories });
  const gamesQuery = useQuery({ queryKey: listingKeys.games, queryFn: listGames });
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : null, [cover]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const command = { input, media: { cover, gallery, video }, actor };
      return editing ? updateListing({ ...command, listingId: existing!.id }) : createListing(command);
    },
    onSuccess: async (listing) => {
      await queryClient.invalidateQueries({ queryKey: listingKeys.all });
      navigate(`/listings/${listing.id}`);
    },
  });
  const activateMutation = useMutation({
    mutationFn: () => activateListing({ listingId: existing!.id, actor }),
    onSuccess: async (listing) => {
      queryClient.setQueryData(listingKeys.detail(listing.id), listing);
      await queryClient.invalidateQueries({ queryKey: listingKeys.all });
      await queryClient.invalidateQueries({ queryKey: listingKeys.detail(listing.id) });
      navigate(`/listings/${listing.id}/edit`);
    },
  });

  function updateField<Key extends keyof ListingInput>(key: Key, value: ListingInput[Key]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!input.title.trim() || !input.description.trim() || !input.categoryId || !input.price) {
      setFormError("Title, category, description and price are required.");
      return;
    }
    if (!Number.isFinite(Number(input.price)) || Number(input.price) <= 0) {
      setFormError("Price must be greater than zero.");
      return;
    }
    if (!editing && !cover) {
      setFormError("A cover image is required for a new listing.");
      return;
    }
    const mediaError = validateCover(cover) ?? validateGallery(gallery) ?? validateVideo(video);
    if (mediaError) {
      setFormError(mediaError);
      return;
    }
    saveMutation.mutate();
  }

  const existingCover = existing?.cover.url;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-gray-200 pb-6">
        <Button asChild size="sm" variant="ghost"><Link to="/sell/listings"><ArrowLeft className="size-4" aria-hidden="true" />My listings</Link></Button>
        <p className="mt-5 text-sm font-semibold text-emerald-700">Seller workspace</p>
        <h1 className="mt-1 text-3xl font-bold tracking-normal">{editing ? "Edit listing" : "Create listing"}</h1>
      </header>

      <form className="py-7" onSubmit={submit}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <section aria-labelledby="listing-information">
              <h2 className="text-lg font-semibold" id="listing-information">Listing information</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Title</span>
                  <Input maxLength={120} required value={input.title} onChange={(event) => updateField("title", event.target.value)} placeholder="Example: Platinum ranked account" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Category</span>
                  <select className={fieldClass} required value={input.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}>
                    <option value="">Choose category</option>
                    {(categoriesQuery.data ?? []).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Game <span className="font-normal text-gray-500">(optional)</span></span>
                  <select className={fieldClass} value={input.gameId ?? ""} onChange={(event) => updateField("gameId", event.target.value || null)}>
                    <option value="">No specific game</option>
                    {(gamesQuery.data ?? []).map((game) => <option value={game.id} key={game.id}>{game.name}</option>)}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Price in Coin</span>
                  <Input inputMode="decimal" min="0.01" required step="0.01" type="number" value={input.price} onChange={(event) => updateField("price", event.target.value)} placeholder="0.00" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Description</span>
                  <textarea className={`${fieldClass} min-h-40 resize-y py-3 leading-6`} maxLength={3000} required value={input.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Describe exactly what the Buyer receives and how delivery works." />
                  <span className="mt-1 block text-right text-xs text-gray-500">{input.description.length}/3000</span>
                </label>
              </div>
            </section>

            <section className="border-t border-gray-200 pt-6" aria-labelledby="listing-media">
              <h2 className="text-lg font-semibold" id="listing-media">Media</h2>
              <div className="mt-4 grid gap-4">
                <label className="block rounded-md border border-dashed border-gray-300 bg-white p-4 hover:border-gray-500">
                  <span className="flex items-center gap-2 text-sm font-semibold"><ImagePlus className="size-5 text-emerald-700" aria-hidden="true" />Cover image {editing ? "(replace optional)" : ""}</span>
                  <span className="mt-1 block text-xs text-gray-500">One JPEG, PNG or WebP, maximum 5 MB.</span>
                  <input className="mt-3 block w-full text-sm" accept="image/jpeg,image/png,image/webp" required={!editing} type="file" onChange={(event) => setCover(event.target.files?.[0] ?? null)} />
                </label>
                <label className="block rounded-md border border-dashed border-gray-300 bg-white p-4 hover:border-gray-500">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Upload className="size-5 text-blue-700" aria-hidden="true" />Gallery images</span>
                  <span className="mt-1 block text-xs text-gray-500">Up to five JPEG, PNG or WebP images, maximum 5 MB each.</span>
                  <input className="mt-3 block w-full text-sm" accept="image/jpeg,image/png,image/webp" multiple type="file" onChange={(event) => setGallery(Array.from(event.target.files ?? []))} />
                  {gallery.length ? <span className="mt-2 block text-xs font-medium text-gray-700">{gallery.length} image{gallery.length === 1 ? "" : "s"} selected</span> : null}
                </label>
                <label className="block rounded-md border border-dashed border-gray-300 bg-white p-4 hover:border-gray-500">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Video className="size-5 text-amber-700" aria-hidden="true" />Product video <span className="font-normal text-gray-500">(optional)</span></span>
                  <span className="mt-1 block text-xs text-gray-500">One MP4 or WebM video, maximum 25 MB.</span>
                  <input className="mt-3 block w-full text-sm" accept="video/mp4,video/webm" type="file" onChange={(event) => setVideo(event.target.files?.[0] ?? null)} />
                </label>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Listing preview and save">
            <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
              <div className="aspect-[3/2] bg-gray-100">
                {coverPreview || existingCover ? <img className="h-full w-full object-cover" src={coverPreview ?? existingCover} alt="Listing cover preview" /> : <div className="grid h-full place-items-center text-sm text-gray-500">Cover preview</div>}
              </div>
              <div className="p-4">
                <p className="truncate font-semibold">{input.title || "Listing title"}</p>
                <p className="mt-2 text-xl font-bold">{input.price || "0.00"} Coin</p>
                <p className={existing?.status === "INACTIVE" ? "mt-2 text-xs font-semibold text-red-700" : "mt-2 text-xs font-semibold text-emerald-700"}>Status: {existing?.status ?? "ACTIVE"}</p>
              </div>
            </div>
            {(formError || saveMutation.isError || activateMutation.isError) ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{formError ?? saveMutation.error?.message ?? activateMutation.error?.message}</p> : null}
            {editing && existing?.status === "INACTIVE" ? (
              <Button className="mt-4 w-full" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate()} type="button">
                {activateMutation.isPending ? "Activating..." : "Activate listing"}
              </Button>
            ) : null}
            <Button className="mt-4 w-full" disabled={saveMutation.isPending || categoriesQuery.isPending || gamesQuery.isPending} type="submit">
              <Save className="size-4" aria-hidden="true" />{saveMutation.isPending ? "Saving..." : editing ? "Save changes" : "Publish listing"}
            </Button>
          </aside>
        </div>
      </form>
    </div>
  );
}

export function ListingFormPage() {
  const { listingId } = useParams();
  const editing = Boolean(listingId);
  const session = useAuthStore((state) => state.session)!;
  const actor: ListingActor = { id: session.user.id, name: session.user.name, email: session.user.email };
  const listingQuery = useQuery({
    queryKey: listingKeys.detail(listingId ?? "new"),
    queryFn: () => getListing(listingId!),
    enabled: editing,
  });

  if (editing && listingQuery.isPending) {
    return <MarketplaceState kind="loading" title="Loading listing" description="Preparing the listing editor." />;
  }

  if (editing && (listingQuery.isError || (listingQuery.data && !isListingOwner(listingQuery.data, actor)))) {
    return <MarketplaceState kind="error" title="Cannot edit listing" description="The listing does not exist or does not belong to this Seller account." />;
  }

  return <ListingEditor actor={actor} existing={listingQuery.data} />;
}
