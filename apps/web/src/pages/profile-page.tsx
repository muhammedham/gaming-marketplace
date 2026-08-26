import { BadgeCheck, Mail, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../store/auth-store";

export function ProfilePage() {
  const session = useAuthStore((state) => state.session);

  if (!session) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-gray-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">Account</p>
        <h1 className="mt-2 text-3xl font-bold">{session.user.name}</h1>
      </div>

      <div className="grid gap-8 py-8 md:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="profile-details">
          <h2 className="text-lg font-semibold" id="profile-details">
            Profile details
          </h2>
          <dl className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="flex items-center gap-2 text-sm text-gray-500">
                <Mail className="size-4" aria-hidden="true" /> Email
              </dt>
              <dd className="break-all text-right text-sm font-medium">{session.user.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="flex items-center gap-2 text-sm text-gray-500">
                <BadgeCheck className="size-4" aria-hidden="true" /> Role
              </dt>
              <dd className="text-sm font-medium capitalize">{session.user.role.toLowerCase()}</dd>
            </div>
          </dl>
        </section>

        <aside className="rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="wallet-summary">
          <div className="flex items-center gap-2">
            <WalletCards className="size-5 text-emerald-700" aria-hidden="true" />
            <h2 className="font-semibold" id="wallet-summary">
              Wallet
            </h2>
          </div>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-sm text-gray-500">Available</dt>
              <dd className="mt-1 text-2xl font-bold">{session.wallet.availableBalance} Coin</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Held</dt>
              <dd className="mt-1 text-lg font-semibold">{session.wallet.heldBalance} Coin</dd>
            </div>
          </dl>
          <Link className="mt-5 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-900" to="/wallet">
            Open wallet and transaction history →
          </Link>
        </aside>
      </div>
    </div>
  );
}
