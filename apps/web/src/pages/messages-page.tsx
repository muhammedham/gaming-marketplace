import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getConversation, listConversations } from "../features/orders/api";
import { ChatPanel } from "../features/orders/chat-panel";
import {
  cardClass,
  Feedback,
  PageFrame,
  Pagination,
} from "../features/orders/ui";
import { dateLabel, useMarketKeys } from "../features/orders/hooks";
import { useAuthStore } from "../store/auth-store";

export function MessagesPage() {
  const { conversationId = "" } = useParams(),
    key = useMarketKeys();
  const role = useAuthStore((s) => s.session?.user.role);
  const [page, setPage] = useState(1);
  const chats = useQuery({
    queryKey: key("conversations", page),
    queryFn: () => listConversations(page),
    refetchInterval: 5000,
  });
  const current = useQuery({
    queryKey: key("conversation", conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: !!conversationId,
  });
  return (
    <PageFrame
      title="Messages"
      description="Buyer/seller conversations linked to a listing or an order. Text and history only."
    >
      <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
        <section className={cardClass}>
          <Feedback
            pending={chats.isPending}
            error={chats.error}
            empty={chats.isSuccess && !chats.data.items.length}
          />
          <div className="space-y-2">
            {chats.data?.items.map((chat) => (
              <Link
                key={chat.id}
                to={`/messages/${chat.id}`}
                className={`block rounded-lg border p-3 ${conversationId === chat.id ? "border-emerald-400 bg-emerald-50" : "border-gray-200"}`}
              >
                <p className="font-semibold">{chat.listing.title}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {chat.buyer.name} ↔ {chat.seller.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {chat.orderId ? "Order chat" : "Listing question"} ·{" "}
                  {dateLabel(chat.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
          <Pagination data={chats.data} page={page} setPage={setPage} />
        </section>
        <section className={cardClass}>
          {!conversationId ? (
            <p className="text-sm text-gray-500">
              Choose a conversation, or use Message Seller on a listing.
            </p>
          ) : (
            <>
              <Feedback pending={current.isPending} error={current.error} />
              {current.data && (
                <>
                  <Link
                    className="mb-4 block text-sm text-emerald-700 underline"
                    to={
                      current.data.orderId
                        ? `/orders/${current.data.orderId}`
                        : `/listings/${current.data.listingId}`
                    }
                  >
                    {current.data.orderId ? "View order" : "View listing"}
                  </Link>
                  <ChatPanel
                    id={conversationId}
                    key={conversationId}
                    readOnly={role === "ADMIN"}
                  />
                </>
              )}
            </>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
