import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { AppShell } from "../layouts/app-shell";
import { AuthLayout } from "../layouts/auth-layout";
import { HomePage } from "../pages/home-page";
import { LoginPage } from "../pages/login-page";
import { NotFoundPage } from "../pages/not-found-page";
import { ProfilePage } from "../pages/profile-page";
import { RegisterPage } from "../pages/register-page";
import { ProtectedRoute } from "../routes/protected-route";

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "profile", element: <ProfilePage /> }],
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

export const appRouter = createBrowserRouter(appRoutes);
