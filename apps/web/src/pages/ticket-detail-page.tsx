import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { getTicket, post, type TicketStatus } from "../features/orders/api";
import { ChatPanel } from "../features/orders/chat-panel";
import {
  cardClass,
  ConfirmDialog,
  Feedback,
  fieldClass,
  PageFrame,
  StatusBadge,
} from "../features/orders/ui";
import { useMarketKeys, useRefreshMarket } from "../features/orders/hooks";
import { apiRequest } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

export function TicketDetailPage() {
  const { ticketId = "" } = useParams(),
    key = useMarketKeys(),
    refresh = useRefreshMarket();
  const admin = useAuthStore((s) => s.session?.user.role === "ADMIN");
  const [resolution, setResolution] = useState<
      "Resume" | "Complete" | "Cancel"
    >("Resume"),
    [body, setBody] = useState(""),
    [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: key("ticket", ticketId),
    queryFn: () => getTicket(ticketId),
    refetchInterval: 5000,
  });
  const status = useMutation({
    mutationFn: (value: TicketStatus) =>
      apiRequest(`/support/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      }),
    onSuccess: refresh,
  });
  const resolve = useMutation({
    mutationFn: () =>
      post(`/support/tickets/${ticketId}/resolve`, {
        action: resolution,
        body,
      }),
    onSuccess: async () => {
      setOpen(false);
      await refresh();
    },
  });
  const ticket = query.data;
  return (
    <PageFrame title="Support ticket" description={ticketId}>
      <Link to="/support" className="text-sm text-emerald-700 underline">
        Back to support
      </Link>
      <Feedback pending={query.isPending} error={query.error} />
      {ticket && (
        <>
          <section className={`${cardClass} space-y-3`}>
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="break-words text-xl font-semibold">
                {ticket.subject}
              </h2>
              <StatusBadge status={ticket.status} />
            </div>
            <p className="text-sm text-gray-500">
              Opened by {ticket.user.name}
            </p>
            {ticket.order && (
              <Link
                className="block text-sm text-emerald-700 underline"
                to={`/orders/${ticket.order.id}`}
              >
                {ticket.order.listingTitle} · {ticket.order.status}
              </Link>
            )}
            {admin && ticket.status !== "Closed" && (
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold">Admin actions</h3>
                <label className="mt-3 block text-sm">
                  Ticket status
                  <select
                    aria-label="Ticket status"
                    className={`${fieldClass} mt-1`}
                    value={ticket.status}
                    disabled={status.isPending}
                    onChange={(e) =>
                      status.mutate(e.target.value as TicketStatus)
                    }
                  >
                    {["Open", "InProgress", "Answered", "Closed"].map((s) => (
                      <option
                        key={s}
                        disabled={
                          s === "Closed" &&
                          ticket.order?.status === "SupportPaused"
                        }
                      >
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <Feedback error={status.error} />
                {status.isSuccess && (
                  <p className="mt-2 text-sm text-emerald-700" role="status">
                    Status updated.
                  </p>
                )}
                {ticket.order?.status === "SupportPaused" && (
                  <form
                    className="mt-5 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      resolve.reset();
                      setOpen(true);
                    }}
                  >
                    <h4 className="font-semibold">Resolve paused order</h4>
                    <label className="block text-sm">
                      Resolution
                      <select
                        aria-label="Resolution"
                        className={`${fieldClass} mt-1`}
                        value={resolution}
                        onChange={(e) =>
                          setResolution(e.target.value as typeof resolution)
                        }
                      >
                        <option value="Resume">
                          Resume with remaining time
                        </option>
                        <option value="Complete">
                          Complete and pay seller
                        </option>
                        <option value="Cancel">Cancel and refund buyer</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      Resolution explanation
                      <textarea
                        className={`${fieldClass} mt-1`}
                        rows={3}
                        required
                        maxLength={1900}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                      />
                    </label>
                    <Button disabled={!body.trim() || resolve.isPending}>
                      Resolve order
                    </Button>
                  </form>
                )}
              </div>
            )}
          </section>
          <section className={cardClass}>
            <ChatPanel
              key={ticketId}
              id={ticketId}
              ticket
              readOnly={ticket.status === "Closed"}
            />
          </section>
        </>
      )}
      <ConfirmDialog
        open={open}
        title="Resolve this order?"
        busy={resolve.isPending}
        onClose={() => setOpen(false)}
        onConfirm={() => resolve.mutate()}
      >
        <p>
          {resolution === "Resume"
            ? "The order will resume with the confirmation time that remained. The ticket will close."
            : resolution === "Complete"
              ? "Held funds will be released to the seller exactly once. The order and ticket will close."
              : "Held funds will be refunded to the buyer. The order will be cancelled and the ticket closed."}
        </p>
        <Feedback error={resolve.error} />
      </ConfirmDialog>
    </PageFrame>
  );
}
