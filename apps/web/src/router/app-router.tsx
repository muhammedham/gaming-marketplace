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
import { WalletPage } from "../pages/wallet-page";
import { OrdersPage } from "../pages/orders-page";
import { OrderDetailPage } from "../pages/order-detail-page";
import { MessagesPage } from "../pages/messages-page";
import { SupportPage } from "../pages/support-page";
import { TicketDetailPage } from "../pages/ticket-detail-page";
import { NotificationsPage } from "../pages/notifications-page";
import { SellerProfilePage } from "../pages/seller-profile-page";
import { AdminPage } from "../pages/admin-page";
import { InventoryAnalysisPage } from "../pages/inventory-analysis-page";
import { ProtectedRoute } from "../routes/protected-route";

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "listings", element: <CatalogPage /> },
      { path: "categories/:categorySlug", element: <CatalogPage categoryMode /> },
      { path: "listings/:listingId", element: <ListingDetailPage /> },
      { path: "sellers/:sellerId", element: <SellerProfilePage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "profile", element: <ProfilePage /> },
          { path: "wallet", element: <WalletPage /> },
          { path: "orders", element: <OrdersPage /> },
          { path: "orders/:orderId", element: <OrderDetailPage /> },
          { path: "messages", element: <MessagesPage /> },
          { path: "messages/:conversationId", element: <MessagesPage /> },
          { path: "support", element: <SupportPage /> },
          { path: "support/:ticketId", element: <TicketDetailPage /> },
          { path: "notifications", element: <NotificationsPage /> },
        ],
      },
      {
        element: <ProtectedRoute roles={["SELLER"]} />,
        children: [
          { path: "sell/listings", element: <SellerListingsPage /> },
          { path: "sell/listings/new", element: <ListingFormPage /> },
          { path: "sell/listings/:listingId/edit", element: <ListingFormPage /> },
          { path: "sell/listings/:listingId/inventory-analysis", element: <InventoryAnalysisPage /> },
        ],
      },
      {
        element: <ProtectedRoute roles={["ADMIN"]} />,
        children: [
          { path: "admin", element: <AdminPage /> },
          { path: "admin/:section", element: <AdminPage /> },
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
