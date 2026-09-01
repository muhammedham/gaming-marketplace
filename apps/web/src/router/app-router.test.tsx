import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { appRoutes } from "./app-router";
import { useAuthStore } from "../store/auth-store";

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("application routes", () => {
  it("renders the marketplace shell", () => {
    useAuthStore.setState({ session: null, status: "unauthenticated" });
    renderRoute("/");

    expect(screen.getByRole("heading", { name: "Find the exact gaming item you need." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toBeInTheDocument();
  });

  it("redirects an unauthenticated profile visit to sign in", async () => {
    useAuthStore.setState({ session: null, status: "unauthenticated" });
    renderRoute("/profile");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("rejects a Buyer from Seller routes", async () => {
    useAuthStore.setState({
      status: "authenticated",
      session: {
        user: { id: "buyer-1", name: "Buyer", email: "buyer@example.com", role: "BUYER" },
        wallet: { availableBalance: "0.00", heldBalance: "0.00", currency: "COIN" },
      },
    });
    renderRoute("/sell/listings/new");

    expect(await screen.findByRole("heading", { name: "Find the exact gaming item you need." })).toBeInTheDocument();
  });

  it("rejects a Buyer from Admin routes", async () => {
    useAuthStore.setState({
      status: "authenticated",
      session: {
        user: { id: "buyer-1", name: "Buyer", email: "buyer@example.com", role: "BUYER" },
        wallet: { availableBalance: "0.00", heldBalance: "0.00", currency: "COIN" },
      },
    });
    renderRoute("/admin");

    expect(await screen.findByRole("heading", { name: "Find the exact gaming item you need." })).toBeInTheDocument();
  });

  it("renders the protected Admin dashboard and navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const data = url.includes("/admin/dashboard")
          ? {
              counts: { users: 3, suspendedUsers: 0, activeCategories: 6, activeGames: 5, activeListings: 1, orders: 2, openSupport: 1, simulatedWithdrawals: 1 },
              balances: { availableCoin: "1000.00", heldCoin: "40.00", simulatedWithdrawnCoin: "5.00", simulatedNetTry: "5.00" },
              ordersByStatus: { Completed: 1, SupportPaused: 1 },
              recentOrders: [],
              recentLedger: [],
              recentAudits: [],
            }
          : { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, unreadCount: 0 };
        return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    useAuthStore.setState({
      status: "authenticated",
      session: {
        user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "ADMIN" },
        wallet: { availableBalance: "0.00", heldBalance: "0.00", currency: "COIN" },
      },
    });
    renderRoute("/admin");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Users/ })).toHaveAttribute("href", "/admin/users");
    expect(await screen.findByText("1 open support")).toBeInTheDocument();
  });
});
