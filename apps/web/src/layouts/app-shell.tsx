import { Gamepad2, LogOut, UserRound, WalletCards } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "../components/ui/button";
import { logout } from "../features/auth/auth-api";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors",
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
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      setUnauthenticated();
      queryClient.removeQueries({ queryKey: ["auth"] });
      navigate("/");
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link className="flex min-w-0 items-center gap-2 font-bold" to="/">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-gray-950 text-white">
              <Gamepad2 className="size-5" aria-hidden="true" />
            </span>
            <span className="hidden truncate sm:inline">Gaming Marketplace</span>
          </Link>

          <nav className="flex h-full items-center" aria-label="Main navigation">
            <NavLink className={navLinkClass} to="/" end>
              Marketplace
            </NavLink>
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
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Create account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
