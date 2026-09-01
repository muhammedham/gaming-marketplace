import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { listOrders } from "../features/orders/api";
import {
  cardClass,
  Feedback,
  PageFrame,
  Pagination,
  StatusBadge,
} from "../features/orders/ui";
import { dateLabel, useMarketKeys } from "../features/orders/hooks";
import { useAuthStore } from "../store/auth-store";

export function OrdersPage() {
  const key = useMarketKeys(),
    role = useAuthStore((s) => s.session?.user.role);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: key("orders", page),
    queryFn: () => listOrders(page),
    refetchInterval: 5000,
  });
  return (
    <PageFrame
      title={
        role === "SELLER"
          ? "Sales orders"
          : role === "ADMIN"
            ? "Orders"
            : "My purchases"
      }
      description="Follow delivery, held funds and confirmation. Updates every 5 seconds."
    >
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.isSuccess && !query.data.items.length}
      />
      <div className="space-y-3">
        {query.data?.items.map((order) => (
          <Link
            to={`/orders/${order.id}`}
            key={order.id}
            className={`${cardClass} block transition hover:border-emerald-400`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{order.listingTitle}</h2>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Buyer: {order.buyer.name} · Seller: {order.seller.name}
            </p>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
              <strong>{order.price} Coin</strong>
              <time className="text-gray-500">
                {dateLabel(order.createdAt)}
              </time>
            </div>
          </Link>
        ))}
      </div>
      <Pagination data={query.data} page={page} setPage={setPage} />
    </PageFrame>
  );
}
