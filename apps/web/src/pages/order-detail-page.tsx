import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { getOrder, post, type Order } from "../features/orders/api";
import { ChatPanel } from "../features/orders/chat-panel";
import {
  cardClass,
  ConfirmDialog,
  Feedback,
  fieldClass,
  PageFrame,
  StatusBadge,
} from "../features/orders/ui";
import {
  countdownLabel,
  dateLabel,
  useMarketKeys,
  useRefreshMarket,
} from "../features/orders/hooks";
import { useAuthStore } from "../store/auth-store";

function Countdown({
  order,
  receivedAt,
}: {
  order: Order;
  receivedAt: number;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const serverNow =
    new Date(order.serverTime).getTime() + Math.max(0, now - receivedAt);
  const remaining = order.autoConfirmAt
    ? new Date(order.autoConfirmAt).getTime() - serverNow
    : 0;
  if (order.status === "SupportPaused")
    return (
      <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Confirmation paused by support</strong>
        <p className="mt-1">
          No automatic funds transfer while this order is paused.
          {order.pausedRemainingMs !== null &&
            ` Remaining time: ${countdownLabel(order.pausedRemainingMs)}.`}
        </p>
      </div>
    );
  if (order.status !== "WaitingConfirmation") return null;
  return (
    <div className="rounded-lg bg-blue-50 p-4">
      <p className="text-sm font-medium text-blue-900">
        Automatic confirmation countdown
      </p>
      <p className="mt-1 font-mono text-3xl font-semibold text-blue-950">
        {countdownLabel(remaining)}
      </p>
      <p className="mt-2 text-xs text-blue-800">
        {remaining > 0
          ? "Check delivery and open support before this timer expires if something is wrong."
          : "Confirmation is due. Waiting for the server to complete the order."}
      </p>
    </div>
  );
}
export function OrderDetailPage() {
  const { orderId = "" } = useParams(),
    key = useMarketKeys(),
    refresh = useRefreshMarket();
  const user = useAuthStore((s) => s.session?.user);
  const [action, setAction] = useState<"deliver" | "confirm" | "cancel" | null>(
    null,
  );
  const [deliveryNote, setDeliveryNote] = useState("");
  const [rating, setRating] = useState(5),
    [comment, setComment] = useState("");
  const query = useQuery({
    queryKey: key("order", orderId),
    queryFn: () => getOrder(orderId),
    refetchInterval: 5000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      post(
        `/orders/${orderId}/${action}`,
        action === "deliver" ? { deliveryNote } : undefined,
      ),
    onSuccess: async () => {
      setAction(null);
      await refresh();
    },
  });
  const review = useMutation({
    mutationFn: () => post(`/orders/${orderId}/review`, { rating, comment }),
    onSuccess: refresh,
  });
  const order = query.data,
    buyer = user?.id === order?.buyerId,
    seller = user?.id === order?.sellerId;
  function choose(value: "deliver" | "confirm" | "cancel") {
    mutation.reset();
    setAction(value);
  }
  return (
    <PageFrame title="Order details" description={`Order ${orderId}`}>
      <Link className="text-sm text-emerald-700 underline" to="/orders">
        Back to orders
      </Link>
      <Feedback pending={query.isPending} error={query.error} />
      {order && (
        <>
          <div className={`${cardClass} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{order.listingTitle}</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Buyer: {order.buyer.name} · Seller: {order.seller.name}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-2xl font-bold">{order.price} Coin</p>
            <p className="text-sm text-gray-600">
              {order.status === "Completed"
                ? "Funds released to the seller."
                : order.status === "Cancelled"
                  ? "Funds refunded to the buyer."
                  : "Funds are held safely in the buyer's wallet until resolution."}
            </p>
            <Countdown order={order} receivedAt={query.dataUpdatedAt} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              <section className={`${cardClass} space-y-4`}>
                <h2 className="text-lg font-semibold">Delivery & actions</h2>
                {order.deliveryNote ? (
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500">
                      SELLER DELIVERY
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {order.deliveryNote}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {order.deliveredAt && dateLabel(order.deliveredAt)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    The seller has not marked delivery yet.
                  </p>
                )}
                {seller && order.status === "WaitingDelivery" && (
                  <div className="space-y-2">
                    <label
                      htmlFor="delivery-note"
                      className="block text-sm font-medium"
                    >
                      Delivery details
                    </label>
                    <textarea
                      id="delivery-note"
                      className={fieldClass}
                      rows={4}
                      maxLength={2000}
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Describe what you delivered and how the buyer can check it."
                    />
                    <Button
                      disabled={!deliveryNote.trim()}
                      onClick={() => choose("deliver")}
                    >
                      Mark delivered
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {buyer && order.status === "WaitingConfirmation" && (
                    <Button onClick={() => choose("confirm")}>
                      Confirm receipt
                    </Button>
                  )}
                  {(buyer || seller || user?.role === "ADMIN") &&
                    order.status === "WaitingDelivery" && (
                      <Button variant="danger" onClick={() => choose("cancel")}>
                        Cancel & refund
                      </Button>
                    )}
                  {buyer &&
                    ["WaitingDelivery", "WaitingConfirmation"].includes(
                      order.status,
                    ) && (
                      <Button asChild variant="secondary">
                        <Link to={`/support?orderId=${order.id}`}>
                          Open support ticket
                        </Link>
                      </Button>
                    )}
                </div>
                {order.tickets?.map((t) => (
                  <Link
                    key={t.id}
                    className="block text-sm text-emerald-700 underline"
                    to={`/support/${t.id}`}
                  >
                    {t.subject} · {t.status}
                  </Link>
                ))}
                {order.status === "Completed" && (
                  <div className="border-t border-gray-100 pt-4">
                    <h3 className="font-semibold">Seller review</h3>
                    {order.review ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                        {"★".repeat(order.review.rating)} ·{" "}
                        {order.review.comment || "No comment"}
                      </p>
                    ) : buyer ? (
                      <form
                        className="mt-3 space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          review.mutate();
                        }}
                      >
                        <label className="block text-sm">
                          Rating
                          <select
                            aria-label="Rating"
                            className={`${fieldClass} mt-1`}
                            value={rating}
                            onChange={(e) => setRating(Number(e.target.value))}
                          >
                            {[5, 4, 3, 2, 1].map((n) => (
                              <option key={n} value={n}>
                                {n} stars
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm">
                          Comment (optional)
                          <textarea
                            aria-label="Review comment"
                            className={`${fieldClass} mt-1`}
                            maxLength={1000}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                          />
                        </label>
                        <Feedback error={review.error} />
                        <Button disabled={review.isPending}>
                          Submit review
                        </Button>
                        <p className="text-xs text-gray-500">
                          One review per completed order.
                        </p>
                      </form>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">
                        No review yet.
                      </p>
                    )}
                  </div>
                )}
              </section>
              {order.conversation && (
                <div className={cardClass}>
                  <ChatPanel
                    key={order.conversation.id}
                    id={order.conversation.id}
                    readOnly={user?.role === "ADMIN"}
                  />
                </div>
              )}
            </div>
            <section className={`${cardClass} self-start`}>
              <h2 className="text-lg font-semibold">Status timeline</h2>
              <ol className="mt-5 space-y-5 border-l border-emerald-200 pl-5">
                {order.events.map((e) => (
                  <li key={e.id}>
                    <StatusBadge status={e.status} />
                    <p className="mt-2 text-sm text-gray-600">{e.note}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {e.actorRole} · {dateLabel(e.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
      <ConfirmDialog
        open={action !== null}
        title={
          action === "deliver"
            ? "Mark order delivered?"
            : action === "confirm"
              ? "Confirm receipt?"
              : "Cancel and refund?"
        }
        busy={mutation.isPending}
        onClose={() => setAction(null)}
        onConfirm={() => mutation.mutate()}
      >
        <p>
          {action === "deliver"
            ? "This starts the buyer's confirmation countdown. Check the delivery details before continuing."
            : action === "confirm"
              ? "The held Coin will be released to the seller. This action completes the order and cannot be undone."
              : "The held Coin will be returned to the buyer and the order will be cancelled."}
        </p>
        <Feedback error={mutation.error} />
      </ConfirmDialog>
    </PageFrame>
  );
}
