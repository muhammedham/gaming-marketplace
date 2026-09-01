import { apiRequest } from "../../lib/api-client";
import type { OrderStatus, Page, TicketStatus } from "../orders/api";

export type AdminSection =
  | "dashboard"
  | "users"
  | "categories"
  | "games"
  | "listings"
  | "orders"
  | "withdrawals"
  | "support"
  | "settings";

export type RecordStatus = "ACTIVE" | "INACTIVE";
export type UserStatus = "ACTIVE" | "SUSPENDED";
export type UserRole = "BUYER" | "SELLER" | "ADMIN";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  wallet: { availableBalance: string; heldBalance: string } | null;
  _count: { listings: number; purchases: number; sales: number; tickets: number };
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: RecordStatus;
  _count: { listings: number };
};

export type AdminGame = {
  id: string;
  name: string;
  slug: string;
  status: RecordStatus;
  _count: { listings: number };
};

export type AdminListing = {
  id: string;
  title: string;
  price: string;
  status: RecordStatus;
  seller: { id: string; name: string; email: string };
  category: { id: string; name: string; status: RecordStatus };
  game: { id: string; name: string; status: RecordStatus } | null;
  _count: { media: number; orders: number };
  createdAt: string;
};

export type AdminOrder = {
  id: string;
  listingTitle: string;
  price: string;
  status: OrderStatus;
  buyer: { id: string; name: string; email: string };
  seller: { id: string; name: string; email: string };
  tickets: { id: string; status: TicketStatus }[];
  review: { id: string; rating: number } | null;
  createdAt: string;
};

export type AdminWithdrawal = {
  id: string;
  amountCoin: string;
  feeCoin: string;
  netAmountTry: string;
  ibanMasked: string;
  accountHolderName: string;
  status: "COMPLETED";
  simulation: true;
  createdAt: string;
  wallet: { user: { id: string; name: string; email: string } };
};

export type AdminTicket = {
  id: string;
  subject: string;
  status: TicketStatus;
  updatedAt: string;
  user: { id: string; name: string; email: string };
  order: { id: string; listingTitle: string; status: OrderStatus } | null;
  _count: { messages: number };
};

export type AdminSettings = {
  coinTryRate: string;
  withdrawalFeeRate: string;
  autoConfirmationHours: string;
  updatedAt: string;
};

export type AdminDashboard = {
  counts: {
    users: number;
    suspendedUsers: number;
    activeCategories: number;
    activeGames: number;
    activeListings: number;
    orders: number;
    openSupport: number;
    simulatedWithdrawals: number;
  };
  balances: {
    availableCoin: string;
    heldCoin: string;
    simulatedWithdrawnCoin: string;
    simulatedNetTry: string;
  };
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  recentOrders: AdminOrder[];
  recentLedger: {
    id: string;
    sequence: number;
    type: string;
    amount: string;
    orderId: string | null;
    description: string;
    createdAt: string;
    user: { id: string; name: string; email: string };
  }[];
  recentAudits: {
    id: number;
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, unknown>;
    createdAt: string;
    admin: { id: string; name: string };
  }[];
};

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

const patch = <T>(path: string, body: unknown) =>
  apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const post = <T>(path: string, body: unknown) =>
  apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });

export const adminApi = {
  dashboard: () => apiRequest<AdminDashboard>("/admin/dashboard"),
  users: (values: { page: number; q?: string; role?: string; status?: string }) =>
    apiRequest<Page<AdminUser>>(`/admin/users?${queryString(values)}`),
  updateUser: (id: string, body: { role?: UserRole; status?: UserStatus }) =>
    patch<AdminUser>(`/admin/users/${id}`, body),
  categories: (values: { page: number; q?: string; status?: string }) =>
    apiRequest<Page<AdminCategory>>(`/admin/categories?${queryString(values)}`),
  createCategory: (body: { name: string; description: string }) =>
    post<AdminCategory>("/admin/categories", body),
  updateCategory: (id: string, body: Partial<Pick<AdminCategory, "name" | "slug" | "description" | "status">>) =>
    patch<AdminCategory>(`/admin/categories/${id}`, body),
  games: (values: { page: number; q?: string; status?: string }) =>
    apiRequest<Page<AdminGame>>(`/admin/games?${queryString(values)}`),
  createGame: (body: { name: string }) => post<AdminGame>("/admin/games", body),
  updateGame: (id: string, body: Partial<Pick<AdminGame, "name" | "slug" | "status">>) =>
    patch<AdminGame>(`/admin/games/${id}`, body),
  listings: (values: { page: number; q?: string; status?: string }) =>
    apiRequest<Page<AdminListing>>(`/admin/listings?${queryString(values)}`),
  updateListing: (id: string, status: RecordStatus) =>
    patch<AdminListing>(`/admin/listings/${id}`, { status }),
  orders: (values: { page: number; q?: string; status?: string }) =>
    apiRequest<Page<AdminOrder>>(`/admin/orders?${queryString(values)}`),
  orderAction: (id: string, body: { action: "Complete" | "Cancel"; note: string }) =>
    post<AdminOrder>(`/admin/orders/${id}/action`, body),
  withdrawals: (values: { page: number; q?: string }) =>
    apiRequest<Page<AdminWithdrawal>>(`/admin/withdrawals?${queryString(values)}`),
  support: (values: { page: number; q?: string; status?: string }) =>
    apiRequest<Page<AdminTicket>>(`/admin/support?${queryString(values)}`),
  settings: () => apiRequest<AdminSettings>("/admin/settings"),
  updateSettings: (body: Pick<AdminSettings, "coinTryRate" | "withdrawalFeeRate" | "autoConfirmationHours">) =>
    patch<AdminSettings>("/admin/settings", body),
};
