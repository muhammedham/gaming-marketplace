import { Gamepad2 } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

import { SiteFooter } from "./site-footer";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-md">
          <Link className="mb-8 flex items-center justify-center gap-2 text-lg font-bold" to="/">
            <span className="grid size-10 place-items-center rounded-xl bg-gray-950 text-white">
              <Gamepad2 className="size-5" aria-hidden="true" />
            </span>
            Gaming Marketplace
          </Link>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <Outlet />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
