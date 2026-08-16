import { RouterProvider } from "react-router-dom";

import { AppProviders } from "./providers/app-providers";
import { appRouter } from "./router/app-router";

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={appRouter} />
    </AppProviders>
  );
}
