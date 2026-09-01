import { ArrowUpRight, Coins, Gamepad2, Headphones, LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";

const actions = [
  {
    to: "/support",
    icon: Headphones,
    eyebrow: "Need a hand?",
    title: "Open a support ticket",
  },
  {
    to: "/listings",
    icon: LayoutGrid,
    eyebrow: "Explore the market",
    title: "Browse all listings",
  },
  {
    to: "/wallet",
    icon: Coins,
    eyebrow: "Ready to trade?",
    title: "Get marketplace Coins",
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[#758173]/30 bg-[#191102] text-[#FEF5EF]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-2xl border border-[#758173]/35 md:grid-cols-3">
          {actions.map(({ to, icon: Icon, eyebrow, title }, index) => (
            <Link
              className={`group flex min-h-36 flex-col justify-between gap-6 p-6 transition hover:bg-[#0D2149] ${index ? "border-t border-[#758173]/35 md:border-l md:border-t-0" : ""}`}
              key={to}
              to={to}
            >
              <div className="flex items-center justify-between">
                <Icon className="size-5 text-[#758173] transition group-hover:text-[#FEF5EF]" aria-hidden="true" />
                <ArrowUpRight className="size-5 text-[#912F56] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#758173]">{eyebrow}</p>
                <p className="mt-2 text-lg font-semibold">{title}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-6 border-t border-[#758173]/25 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="inline-flex items-center gap-2 text-lg font-bold" to="/">
              <span className="grid size-9 place-items-center rounded-lg bg-[#912F56] text-[#FEF5EF]">
                <Gamepad2 className="size-5" aria-hidden="true" />
              </span>
              Gaming Marketplace
            </Link>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#758173]">
              A focused player-to-player marketplace for digital gaming goods, protected orders and clear support.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#758173]" aria-label="Footer navigation">
            <Link className="hover:text-[#FEF5EF]" to="/listings">Listings</Link>
            <Link className="hover:text-[#FEF5EF]" to="/orders">Orders</Link>
            <Link className="hover:text-[#FEF5EF]" to="/support">Support</Link>
            <Link className="hover:text-[#FEF5EF]" to="/profile">Account</Link>
          </nav>
        </div>

        <p className="mt-8 text-xs text-[#758173]">
          © {new Date().getFullYear()} Gaming Marketplace. Coin deposits and withdrawals are simulation-only.
        </p>
      </div>
    </footer>
  );
}
