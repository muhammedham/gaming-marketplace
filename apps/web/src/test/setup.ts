import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { useAuthStore } from "../store/auth-store";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  useAuthStore.setState({ session: null, status: "checking" });
  vi.unstubAllGlobals();
});
