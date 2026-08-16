import { Gamepad2 } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <Link className="mb-8 flex items-center justify-center gap-2 text-lg font-bold" to="/">
          <span className="grid size-9 place-items-center rounded-md bg-gray-950 text-white">
            <Gamepad2 className="size-5" aria-hidden="true" />
          </span>
          Gaming Marketplace
        </Link>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
