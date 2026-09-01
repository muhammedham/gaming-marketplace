import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { useAuthStore } from "../../store/auth-store";
import { listMessages, post } from "./api";
import { Feedback, fieldClass, Pagination } from "./ui";
import { dateLabel, useMarketKeys, useRefreshMarket } from "./hooks";

export function ChatPanel({
  id,
  ticket = false,
  readOnly = false,
}: {
  id: string;
  ticket?: boolean;
  readOnly?: boolean;
}) {
  const key = useMarketKeys(),
    refresh = useRefreshMarket();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [page, setPage] = useState(1),
    [body, setBody] = useState("");
  const query = useQuery({
    queryKey: key("messages", ticket, id, page),
    queryFn: () => listMessages(id, page, ticket),
    refetchInterval: 5000,
  });
  const send = useMutation({
    mutationFn: () =>
      post(`/${ticket ? "support/tickets" : "conversations"}/${id}/messages`, {
        body: body.trim(),
      }),
    onSuccess: async () => {
      setBody("");
      setPage(1);
      await refresh();
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (body.trim() && !send.isPending) send.mutate();
  }
  return (
    <section
      aria-label={ticket ? "Support replies" : "Order chat"}
      className="space-y-4"
    >
      <div>
        <h2 className="text-lg font-semibold">
          {ticket ? "Support replies" : "Messages"}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Text only · Updates every 5 seconds · Newest page first
        </p>
      </div>
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.isSuccess && !query.data.items.length}
      />
      <div className="max-h-96 space-y-3 overflow-y-auto" aria-live="polite">
        {query.data?.items.map((m) => (
          <article
            key={m.id}
            className={`max-w-[95%] rounded-lg p-3 ${m.sender.id === userId ? "ml-auto bg-emerald-50" : "bg-gray-100"}`}
          >
            <p className="text-xs font-semibold">
              {m.sender.name} · {m.sender.role}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {m.body}
            </p>
            <time className="mt-2 block text-xs text-gray-500">
              {dateLabel(m.createdAt)}
            </time>
          </article>
        ))}
      </div>
      <Pagination data={query.data} page={page} setPage={setPage} />
      {!readOnly && (
        <form onSubmit={submit} className="space-y-2">
          <label
            className="block text-sm font-medium"
            htmlFor={`message-${id}`}
          >
            Your message
          </label>
          <textarea
            id={`message-${id}`}
            className={fieldClass}
            maxLength={2000}
            required
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Feedback error={send.error} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{body.length}/2000</span>
            <Button disabled={send.isPending || !body.trim()}>
              {send.isPending ? "Sending…" : "Send message"}
            </Button>
          </div>
          {send.isSuccess && (
            <p className="text-xs text-emerald-700" role="status">
              Message sent.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
