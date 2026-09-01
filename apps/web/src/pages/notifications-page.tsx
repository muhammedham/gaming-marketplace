import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { listNotifications, post } from "../features/orders/api";
import {
  cardClass,
  Feedback,
  PageFrame,
  Pagination,
} from "../features/orders/ui";
import {
  dateLabel,
  useMarketKeys,
  useRefreshMarket,
} from "../features/orders/hooks";

export function NotificationsPage() {
  const key = useMarketKeys(),
    refresh = useRefreshMarket(),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: key("notifications", page),
    queryFn: () => listNotifications(page),
    refetchInterval: 5000,
  });
  const read = useMutation({
    mutationFn: (id?: string) =>
      post(id ? `/notifications/${id}/read` : "/notifications/read-all"),
    onSuccess: refresh,
  });
  return (
    <PageFrame
      title="Notifications"
      description="In-site notifications only. Updates every 5 seconds."
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">{query.data?.unreadCount ?? 0} unread</p>
        <Button
          variant="secondary"
          disabled={read.isPending || !query.data?.unreadCount}
          onClick={() => read.mutate(undefined)}
        >
          Mark all read
        </Button>
      </div>
      <Feedback
        pending={query.isPending}
        error={query.error || read.error}
        empty={query.isSuccess && !query.data.items.length}
      />
      <div className="space-y-3">
        {query.data?.items.map((n) => (
          <article
            className={`${cardClass} ${!n.isRead ? "border-l-4 border-l-emerald-500" : ""}`}
            key={n.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                {!n.isRead && (
                  <span className="mr-2 text-emerald-600" aria-label="Unread">
                    ●
                  </span>
                )}
                {n.title}
              </h2>
              <time className="text-xs text-gray-500">
                {dateLabel(n.createdAt)}
              </time>
            </div>
            <p className="mt-2 text-sm text-gray-600">{n.message}</p>
            <div className="mt-3 flex flex-wrap gap-4">
              <Link
                className="text-sm font-semibold text-emerald-700 underline"
                onClick={() => {
                  if (!n.isRead) read.mutate(n.id);
                }}
                to={n.href}
              >
                View details
              </Link>
              {!n.isRead && (
                <button
                  className="text-sm text-gray-500 underline"
                  disabled={read.isPending}
                  onClick={() => read.mutate(n.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <Pagination data={query.data} page={page} setPage={setPage} />
    </PageFrame>
  );
}
