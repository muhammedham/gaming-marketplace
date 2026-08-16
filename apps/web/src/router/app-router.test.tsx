import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

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

    expect(screen.getByRole("heading", { name: "Player-to-player listings" })).toBeInTheDocument();
    expect(screen.getByText("No listings yet")).toBeInTheDocument();
  });

  it("redirects an unauthenticated profile visit to sign in", async () => {
    useAuthStore.setState({ session: null, status: "unauthenticated" });
    renderRoute("/profile");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
