import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { useAuthStore } from "../../store/auth-store";
import { getWallet } from "../wallet/wallet-api";
import { getSeller, post, type Conversation, type Order } from "./api";
import { ConfirmDialog, Feedback } from "./ui";
import { useMarketKeys, useRefreshMarket } from "./hooks";

export function PurchasePanel({
  listingId,
  sellerId,
  price,
  active,
}: {
  listingId: string;
  sellerId: string;
  price: string;
  active: boolean;
}) {
  const session = useAuthStore((s) => s.session),
    navigate = useNavigate(),
    refresh = useRefreshMarket(),
    key = useMarketKeys();
  const [open, setOpen] = useState(false);
  const purchaseKey = useRef(crypto.randomUUID());
  const wallet = useQuery({
    queryKey: key("purchase-wallet"),
    queryFn: getWallet,
    enabled: session?.user.role === "BUYER",
    refetchInterval: 5000,
  });
  const seller = useQuery({
    queryKey: ["seller", sellerId, 1],
    queryFn: () => getSeller(sellerId),
    retry: false,
  });
  const buy = useMutation({
    mutationFn: () =>
      post<Order>("/orders", {
        listingId,
        expectedPrice: price,
        idempotencyKey: purchaseKey.current,
      }),
    onSuccess: async (order) => {
      setOpen(false);
      await refresh();
      navigate(`/orders/${order.id}`);
    },
  });
  const chat = useMutation({
    mutationFn: () => post<Conversation>("/conversations", { listingId }),
    onSuccess: (c) => navigate(`/messages/${c.id}`),
  });
  const insufficient =
    wallet.data && Number(wallet.data.availableBalance) < Number(price);
  return (
    <div className="mt-6 space-y-3 border-t border-gray-200 pt-5">
      <Link
        className="text-sm font-semibold text-emerald-700 underline"
        to={`/sellers/${sellerId}`}
      >
        {seller.data
          ? `${seller.data.averageRating?.toFixed(1) ?? "No"} stars · ${seller.data.reviewCount} reviews · Seller profile`
          : "View seller profile"}
      </Link>
      {!session ? (
        <Button asChild className="w-full">
          <Link to="/login" state={{ from: `/listings/${listingId}` }}>
            Sign in to buy or message
          </Link>
        </Button>
      ) : session.user.role === "BUYER" ? (
        <>
          <p className="text-sm text-gray-600">
            Available: {wallet.data?.availableBalance ?? "…"} Coin. Purchase
            funds stay Held until the order completes.
          </p>
          <Feedback error={wallet.error} />
          {insufficient && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Insufficient balance.{" "}
              <Link className="font-semibold underline" to="/wallet">
                Add simulated Coin
              </Link>{" "}
              before buying.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                !active || !wallet.data || !!insufficient || buy.isPending
              }
              onClick={() => {
                buy.reset();
                setOpen(true);
              }}
            >
              Buy Now
            </Button>
            <Button
              variant="secondary"
              disabled={chat.isPending || !active}
              onClick={() => chat.mutate()}
            >
              Message Seller
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Demo marketplace: no real payment or automatic product delivery.
          </p>
        </>
      ) : session.user.id !== sellerId ? (
        <p className="text-sm text-gray-500">
          Use a Buyer account to purchase.
        </p>
      ) : null}
      <Feedback error={chat.error} />
      <ConfirmDialog
        open={open}
        title="Confirm purchase"
        busy={buy.isPending}
        onClose={() => setOpen(false)}
        onConfirm={() => buy.mutate()}
      >
        <p>
          {price} Coin will move from your Available balance to Held. The seller
          receives it only after completion.
        </p>
        <Feedback error={buy.error} />
      </ConfirmDialog>
    </div>
  );
}
