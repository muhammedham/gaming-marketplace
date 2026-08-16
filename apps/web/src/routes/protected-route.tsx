import { Navigate, Outlet, useLocation } from "react-router-dom";

import { PageLoader } from "../components/ui/page-loader";
import { useAuthStore } from "../store/auth-store";

export function ProtectedRoute() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);

  if (status === "checking") {
    return <PageLoader />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
