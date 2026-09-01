import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/auth-store";
import { ChatPanel } from "./chat-panel";
import { countdownLabel } from "./hooks";
import { PurchasePanel } from "./purchase-panel";
import { listMessages, getSeller, post } from "./api";
import { getWallet } from "../wallet/wallet-api";

vi.mock("./api", () => ({
  listMessages: vi.fn(),
  getSeller: vi.fn(),
  post: vi.fn(),
}));
vi.mock("../wallet/wallet-api", () => ({ getWallet: vi.fn() }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

function mount(element: React.ReactNode) {
  useAuthStore.setState({
    status: "authenticated",
    session: {
      user: {
        id: "buyer",
        name: "Buyer",
        email: "test@example.local",
        role: "BUYER",
      },
      wallet: {
        availableBalance: "10.00",
        heldBalance: "0.00",
        currency: "COIN",
      },
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe("Sprint 4 UI", () => {
  it("formats countdowns and never displays negative remaining time", () => {
    expect(countdownLabel(86400000)).toBe("24:00:00");
    expect(countdownLabel(3599999)).toBe("01:00:00");
    expect(countdownLabel(-10)).toBe("00:00:00");
  });
  it("disables Buy Now for insufficient balance and links to Wallet", async () => {
    vi.mocked(getWallet).mockResolvedValue({
      availableBalance: "10.00",
      heldBalance: "0.00",
      currency: "COIN",
      coinTryRate: "1.00",
      withdrawalFeeRate: "0",
      simulation: true,
    });
    vi.mocked(getSeller).mockRejectedValue(new Error("No profile"));
    mount(
      <PurchasePanel
        listingId="listing"
        sellerId="seller"
        price="40.00"
        active
      />,
    );
    expect(await screen.findByText(/Insufficient balance/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy Now" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Add simulated Coin" }),
    ).toHaveAttribute("href", "/wallet");
  });
  it("renders API errors rather than silently treating them as empty history", async () => {
    vi.mocked(listMessages).mockRejectedValue(new Error("Access denied"));
    mount(<ChatPanel id="chat" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
  });
  it("polls for new messages without reloading the page", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listMessages)
      .mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      .mockResolvedValue({
        items: [
          {
            id: "m1",
            body: "New delivery message",
            sender: { id: "seller", role: "SELLER", name: "Seller" },
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    mount(<ChatPanel id="chat" />);
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(await screen.findByText("New delivery message")).toBeInTheDocument();
  });
  it("sends text and clears the composer after success", async () => {
    vi.mocked(listMessages).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    vi.mocked(post).mockResolvedValue({});
    mount(<ChatPanel id="chat" />);
    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: "  Hello  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/conversations/chat/messages", {
        body: "Hello",
      }),
    );
    expect(await screen.findByText("Message sent.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your message")).toHaveValue("");
  });
});
