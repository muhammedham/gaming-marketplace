import { Gamepad2, LayoutGrid, LogOut, ShieldCheck, Store, UserRound, WalletCards } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotifications } from "../features/orders/api";

import { Button } from "../components/ui/button";
import { logout } from "../features/auth/auth-api";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-10 items-center gap-1.5 border-b-2 px-1 text-sm font-medium transition-colors",
    isActive
      ? "border-emerald-600 text-gray-950"
      : "border-transparent text-gray-500 hover:text-gray-950",
  );

export function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const notifications = useQuery({ queryKey: ["market", session?.user.id, "notifications", 1], queryFn: () => listNotifications(1), enabled: !!session, refetchInterval: 5000 });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      setUnauthenticated();
      queryClient.clear();
      navigate("/login");
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
          <Link className="flex min-w-0 items-center gap-2 font-bold" to="/">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-gray-950 text-white">
              <Gamepad2 className="size-5" aria-hidden="true" />
            </span>
            <span className="hidden truncate sm:inline">Gaming Marketplace</span>
          </Link>

          <nav className="flex h-full items-center gap-3 sm:gap-5" aria-label="Main navigation">
            <NavLink className={navLinkClass} to="/" end>
              <Gamepad2 className="size-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Marketplace</span>
            </NavLink>
            <NavLink className={navLinkClass} to="/listings">
              <LayoutGrid className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Browse</span>
            </NavLink>
            {session ? (
              <NavLink className={navLinkClass} to="/wallet">
                <WalletCards className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Wallet</span>
              </NavLink>
            ) : null}
            {session?.user.role === "SELLER" ? (
              <NavLink className={navLinkClass} to="/sell/listings">
                <Store className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">Sell</span>
              </NavLink>
            ) : null}
            {session?.user.role === "ADMIN" ? (
              <NavLink className={navLinkClass} to="/admin">
                <ShieldCheck className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">Admin</span>
              </NavLink>
            ) : null}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {status === "authenticated" && session ? (
              <>
                <div className="hidden items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm sm:flex">
                  <WalletCards className="size-4 text-emerald-700" aria-hidden="true" />
                  <span className="font-semibold">{session.wallet.availableBalance} Coin</span>
                </div>
                <Button asChild size="icon" variant="ghost" title="Profile">
                  <Link to="/profile" aria-label="Profile">
                    <UserRound className="size-5" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Sign out"
                  aria-label="Sign out"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="size-5" aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden md:inline-flex">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild className="px-3 sm:px-4">
                  <Link to="/register"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Create account</span></Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {session && <nav className="border-b border-gray-200 bg-white" aria-label="Account navigation"><div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 sm:px-6 lg:px-8">
        <NavLink className={navLinkClass} to="/orders">{session.user.role === "SELLER" ? "Sales orders" : session.user.role === "ADMIN" ? "Orders" : "Purchases"}</NavLink>
        <NavLink className={navLinkClass} to="/messages">Messages</NavLink>
        <NavLink className={navLinkClass} to="/support">{session.user.role === "ADMIN" ? "Support desk" : "Support"}</NavLink>
        <NavLink className={navLinkClass} to="/notifications">Notifications{(notifications.data?.unreadCount ?? 0) > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">{notifications.data!.unreadCount}</span>}</NavLink>
      </div></nav>}

      <main>
        <Outlet />
      </main>
    </div>
  );
}
