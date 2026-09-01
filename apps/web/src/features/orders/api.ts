import { apiRequest } from "../../lib/api-client";

export type Person = {
  id: string;
  name: string;
  role: "BUYER" | "SELLER" | "ADMIN";
};
export type OrderStatus =
  | "Created"
  | "Paid"
  | "WaitingDelivery"
  | "Delivered"
  | "WaitingConfirmation"
  | "Completed"
  | "SupportPaused"
  | "Cancelled";
export type Page<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
export type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  buyer?: { name: string };
};
export type Order = {
  id: string;
  listingId: string;
  listingTitle: string;
  price: string;
  status: OrderStatus;
  buyerId: string;
  sellerId: string;
  buyer: Person;
  seller: Person;
  createdAt: string;
  deliveredAt: string | null;
  autoConfirmAt: string | null;
  completedAt: string | null;
  deliveryNote: string | null;
  pausedRemainingMs: number | null;
  serverTime: string;
  conversation: { id: string } | null;
  review: Review | null;
  events: {
    id: number;
    status: OrderStatus;
    actorRole: string;
    note: string;
    createdAt: string;
  }[];
  tickets: { id: string; subject: string; status: string }[];
};
export type Conversation = {
  id: string;
  buyer: Person;
  seller: Person;
  listing: { title: string };
  listingId: string;
  orderId: string | null;
  updatedAt: string;
};
export type Message = {
  id: string;
  sender: Person;
  body: string;
  createdAt: string;
};
export type TicketStatus = "Open" | "InProgress" | "Answered" | "Closed";
export type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  user: Person;
  orderId: string | null;
  order: { id: string; status: OrderStatus; listingTitle: string } | null;
  updatedAt: string;
};
export type Notification = {
  id: string;
  title: string;
  message: string;
  href: string;
  isRead: boolean;
  createdAt: string;
};
export type SellerProfile = {
  seller: Person & { createdAt: string };
  averageRating: number | null;
  reviewCount: number;
  completedSales: number;
  reviews: Page<Review>;
  listings: { id: string; title: string; price: string }[];
};
export const post = <T>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export const listOrders = (page = 1) =>
  apiRequest<Page<Order>>(`/orders?page=${page}`);
export const getOrder = (id: string) => apiRequest<Order>(`/orders/${id}`);
export const getSeller = (id: string, page = 1) =>
  apiRequest<SellerProfile>(`/sellers/${id}?page=${page}`);
export const listConversations = (page = 1) =>
  apiRequest<Page<Conversation>>(`/conversations?page=${page}`);
export const getConversation = (id: string) =>
  apiRequest<Conversation>(`/conversations/${id}`);
export const listMessages = (id: string, page = 1, ticket = false) =>
  apiRequest<Page<Message>>(
    `/${ticket ? "support/tickets" : "conversations"}/${id}/messages?page=${page}`,
  );
export const listTickets = (page = 1) =>
  apiRequest<Page<Ticket>>(`/support/tickets?page=${page}`);
export const getTicket = (id: string) =>
  apiRequest<Ticket>(`/support/tickets/${id}`);
export const listNotifications = (page = 1) =>
  apiRequest<Page<Notification> & { unreadCount: number }>(
    `/notifications?page=${page}`,
  );
