import { PackageSearch, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useAuthStore } from "../store/auth-store";

export function HomePage() {
  const status = useAuthStore((state) => state.status);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-4 border-b border-gray-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold text-emerald-700">Marketplace</p>
          <h1 className="text-3xl font-bold tracking-normal text-gray-950 sm:text-4xl">
            Player-to-player listings
          </h1>
        </div>
        {status === "unauthenticated" ? (
          <Button asChild variant="secondary">
            <Link to="/login">Sign in to sell</Link>
          </Button>
        ) : null}
      </section>

      <section className="grid gap-4 border-b border-gray-200 py-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Market summary">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-emerald-100 text-emerald-800">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-gray-500">Order protection</p>
            <p className="font-semibold">Held balance workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-amber-100 text-amber-800">
            <WalletCards className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-gray-500">Marketplace balance</p>
            <p className="font-semibold">1 Coin = 1 TRY</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
          <span className="grid size-10 place-items-center rounded-md bg-blue-100 text-blue-800">
            <PackageSearch className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-gray-500">Active listings</p>
            <p className="font-semibold">0 available</p>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-md bg-gray-200 text-gray-700">
            <PackageSearch className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">No listings yet</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Active marketplace listings will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
