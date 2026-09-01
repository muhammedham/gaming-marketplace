import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSeller } from "../features/orders/api";
import {
  cardClass,
  Feedback,
  PageFrame,
  Pagination,
} from "../features/orders/ui";
import { dateLabel } from "../features/orders/hooks";

export function SellerProfilePage() {
  const { sellerId = "" } = useParams(),
    [page, setPage] = useState(1);
  const query = useQuery({
      queryKey: ["seller", sellerId, page],
      queryFn: () => getSeller(sellerId, page),
    }),
    data = query.data;
  return (
    <PageFrame title="Seller profile">
      <Feedback pending={query.isPending} error={query.error} />
      {data && (
        <>
          <section className={`${cardClass} flex flex-wrap items-center gap-5`}>
            <span
              className="grid size-16 place-items-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-800"
              aria-label="Seller avatar"
            >
              {data.seller.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2 className="text-2xl font-bold">{data.seller.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                Member since{" "}
                {new Date(data.seller.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-2 text-sm">
                ★ {data.averageRating?.toFixed(1) ?? "Not rated"} ·{" "}
                {data.reviewCount} reviews · {data.completedSales} completed
                sales
              </p>
            </div>
          </section>
          <div className="grid gap-6 md:grid-cols-2">
            <section className={`${cardClass} space-y-4`}>
              <h2 className="text-lg font-semibold">Buyer reviews</h2>
              <Feedback empty={!data.reviews.items.length} />
              {data.reviews.items.map((r) => (
                <article className="border-t border-gray-100 pt-3" key={r.id}>
                  <p className="text-sm font-semibold">
                    {"★".repeat(r.rating)} · {r.buyer?.name}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {r.comment || "No comment"}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {dateLabel(r.createdAt)}
                  </p>
                </article>
              ))}
              <Pagination data={data.reviews} page={page} setPage={setPage} />
            </section>
            <section className={`${cardClass} space-y-3`}>
              <h2 className="text-lg font-semibold">Latest active listings</h2>
              <Feedback empty={!data.listings.length} />
              {data.listings.map((l) => (
                <Link
                  key={l.id}
                  to={`/listings/${l.id}`}
                  className="flex justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm hover:border-emerald-400"
                >
                  <span>{l.title}</span>
                  <strong className="shrink-0">{l.price} Coin</strong>
                </Link>
              ))}
            </section>
          </div>
        </>
      )}
    </PageFrame>
  );
}
