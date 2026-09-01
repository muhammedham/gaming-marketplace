import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Gamepad2,
  LayoutGrid,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { logout } from "../features/auth/auth-api";
import { listNotifications } from "../features/orders/api";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import { SiteFooter } from "./site-footer";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-10 items-center gap-1.5 border-b-2 px-1 text-sm font-semibold transition-colors",
    isActive
      ? "border-[#912F56] text-[#191102]"
      : "border-transparent text-[#758173] hover:text-[#191102]",
  );

const iconLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative grid size-10 shrink-0 place-items-center rounded-full border transition",
    isActive
      ? "border-[#912F56] bg-[#912F56] text-[#FEF5EF]"
      : "border-[#758173]/35 text-[#191102] hover:border-[#912F56] hover:text-[#912F56]",
  );

export function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const notifications = useQuery({
    queryKey: ["market", session?.user.id, "notifications", 1],
    queryFn: () => listNotifications(1),
    enabled: !!session,
    refetchInterval: 5000,
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      setUnauthenticated();
      queryClient.clear();
      navigate("/login");
    },
  });

  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-950">
      <header className="sticky top-0 z-40 border-b border-[#758173]/25 bg-[#FEF5EF]/95 backdrop-blur">
        <div className="mx-auto flex h-17 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:px-8">
          <Link
            className="flex min-w-0 items-center gap-2.5 font-bold"
            to="/"
            aria-label="Gaming Marketplace home"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#191102] text-[#FEF5EF] shadow-sm">
              <Gamepad2 className="size-5" aria-hidden="true" />
            </span>
            <span className="hidden truncate lg:inline">Gaming Marketplace</span>
          </Link>

          <nav className="flex h-full items-center gap-3 sm:gap-5" aria-label="Main navigation">
            <NavLink className={navLinkClass} to="/listings">
              <LayoutGrid className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Browse</span>
            </NavLink>
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
                <NavLink className={iconLinkClass} to="/messages" title="Messages" aria-label="Messages">
                  <MessageCircle className="size-4.5" aria-hidden="true" />
                </NavLink>
                <NavLink
                  className={iconLinkClass}
                  to="/notifications"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="size-4.5" aria-hidden="true" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 grid min-w-4.5 place-items-center rounded-full bg-[#912F56] px-1 text-[10px] font-bold text-[#FEF5EF]">
                      {Math.min(unreadCount, 9)}{unreadCount > 9 ? "+" : ""}
                    </span>
                  ) : null}
                </NavLink>
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition",
                      isActive
                        ? "border-[#0D2149] bg-[#0D2149] text-[#FEF5EF]"
                        : "border-[#758173]/35 hover:border-[#0D2149]",
                    )
                  }
                  to="/wallet"
                  title="Wallet"
                >
                  <WalletCards className="size-4" aria-hidden="true" />
                  <span className="hidden lg:inline">{session.wallet.availableBalance} Coin</span>
                </NavLink>
                <NavLink className={iconLinkClass} to="/profile" title="Profile" aria-label="Profile">
                  <UserRound className="size-4.5" aria-hidden="true" />
                </NavLink>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Sign out"
                  aria-label="Sign out"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="size-4.5" aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild className="px-3 sm:px-4">
                  <Link to="/register">
                    <span className="sm:hidden">Join</span>
                    <span className="hidden sm:inline">Create account</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {session ? (
          <nav className="border-t border-[#758173]/20" aria-label="Account navigation">
            <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 sm:px-6 lg:px-8">
              <NavLink className={navLinkClass} to="/orders">
                {session.user.role === "SELLER"
                  ? "Sales orders"
                  : session.user.role === "ADMIN"
                    ? "Orders"
                    : "Purchases"}
              </NavLink>
              <NavLink className={navLinkClass} to="/support">
                {session.user.role === "ADMIN" ? "Support desk" : "Support"}
              </NavLink>
            </div>
          </nav>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}
