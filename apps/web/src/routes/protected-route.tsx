import { Navigate, Outlet, useLocation } from "react-router-dom";

import { PageLoader } from "../components/ui/page-loader";
import { useAuthStore } from "../store/auth-store";
import type { UserRole } from "../types/auth";

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const location = useLocation();
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);

  if (status === "checking") {
    return <PageLoader />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && (!session || !roles.includes(session.user.role))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
