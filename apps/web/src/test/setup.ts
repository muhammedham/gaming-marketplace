import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";

import { useAuthStore } from "../store/auth-store";

afterEach(() => {
  useAuthStore.setState({ session: null, status: "checking" });
});
