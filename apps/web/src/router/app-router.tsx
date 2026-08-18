import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { AppShell } from "../layouts/app-shell";
import { AuthLayout } from "../layouts/auth-layout";
import { CatalogPage } from "../pages/catalog-page";
import { HomePage } from "../pages/home-page";
import { ListingDetailPage } from "../pages/listing-detail-page";
import { ListingFormPage } from "../pages/listing-form-page";
import { LoginPage } from "../pages/login-page";
import { NotFoundPage } from "../pages/not-found-page";
import { ProfilePage } from "../pages/profile-page";
import { RegisterPage } from "../pages/register-page";
import { SellerListingsPage } from "../pages/seller-listings-page";
import { ProtectedRoute } from "../routes/protected-route";

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "listings", element: <CatalogPage /> },
      { path: "categories/:categorySlug", element: <CatalogPage categoryMode /> },
      { path: "listings/:listingId", element: <ListingDetailPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "profile", element: <ProfilePage /> }],
      },
      {
        element: <ProtectedRoute roles={["SELLER"]} />,
        children: [
          { path: "sell/listings", element: <SellerListingsPage /> },
          { path: "sell/listings/new", element: <ListingFormPage /> },
          { path: "sell/listings/:listingId/edit", element: <ListingFormPage /> },
        ],
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
