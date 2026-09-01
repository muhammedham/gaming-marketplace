import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { listTickets, post, type Ticket } from "../features/orders/api";
import {
  cardClass,
  ConfirmDialog,
  Feedback,
  fieldClass,
  PageFrame,
  Pagination,
  StatusBadge,
} from "../features/orders/ui";
import {
  dateLabel,
  useMarketKeys,
  useRefreshMarket,
} from "../features/orders/hooks";
import { useAuthStore } from "../store/auth-store";

export function SupportPage() {
  const key = useMarketKeys(),
    refresh = useRefreshMarket(),
    navigate = useNavigate();
  const [params] = useSearchParams(),
    orderId = params.get("orderId") || undefined;
  const admin = useAuthStore((s) => s.session?.user.role === "ADMIN");
  const [page, setPage] = useState(1),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: key("tickets", page),
    queryFn: () => listTickets(page),
    refetchInterval: 5000,
  });
  const create = useMutation({
    mutationFn: () =>
      post<Ticket>("/support/tickets", {
        subject,
        body,
        ...(orderId ? { orderId } : {}),
      }),
    onSuccess: async (ticket) => {
      setOpen(false);
      await refresh();
      navigate(`/support/${ticket.id}`);
    },
  });
  return (
    <PageFrame
      title={admin ? "Support desk" : "Support"}
      description="Ask for help, follow replies, and resolve order issues."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${cardClass} space-y-4`}>
          <h2 className="text-lg font-semibold">
            {admin ? "All tickets" : "Your tickets"}
          </h2>
          <Feedback
            pending={query.isPending}
            error={query.error}
            empty={query.isSuccess && !query.data.items.length}
          />
          {query.data?.items.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/support/${ticket.id}`}
              className="block space-y-2 rounded-lg border border-gray-200 p-4 hover:border-emerald-400"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong className="break-words">{ticket.subject}</strong>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="text-xs text-gray-500">
                {ticket.user.name} · {dateLabel(ticket.updatedAt)}
              </p>
              {ticket.order && (
                <p className="text-xs text-gray-600">
                  {ticket.order.listingTitle} · {ticket.order.status}
                </p>
              )}
            </Link>
          ))}
          <Pagination data={query.data} page={page} setPage={setPage} />
        </section>
        <section className={`${cardClass} self-start`}>
          <h2 className="text-lg font-semibold">New ticket</h2>
          {orderId ? (
            <div className="my-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Linked to order{" "}
              <Link className="underline" to={`/orders/${orderId}`}>
                {orderId}
              </Link>
              . A successful submission before the deadline pauses automatic
              confirmation.{" "}
              <Link className="underline" to="/support">
                Use a general ticket instead
              </Link>
              .
            </div>
          ) : (
            <p className="my-3 text-sm text-gray-500">
              For a delivery problem, open a linked ticket from Order Details to
              pause its countdown.
            </p>
          )}
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.reset();
              setOpen(true);
            }}
          >
            <label className="block text-sm font-medium">
              Subject
              <input
                className={`${fieldClass} mt-1`}
                required
                maxLength={160}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Describe the issue
              <textarea
                className={`${fieldClass} mt-1`}
                required
                rows={5}
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <Button
              disabled={!subject.trim() || !body.trim() || create.isPending}
            >
              Create ticket
            </Button>
          </form>
        </section>
      </div>
      <ConfirmDialog
        open={open}
        title="Submit support ticket?"
        busy={create.isPending}
        onClose={() => setOpen(false)}
        onConfirm={() => create.mutate()}
      >
        <p>
          {orderId
            ? "This pauses the linked order and keeps funds held while support investigates."
            : "Your ticket and message will be sent to the support desk."}
        </p>
        <Feedback error={create.error} />
      </ConfirmDialog>
    </PageFrame>
  );
}
