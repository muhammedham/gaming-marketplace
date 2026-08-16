import { create } from "zustand";

import type { AuthSession } from "../types/auth";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

interface AuthState {
  session: AuthSession | null;
  status: AuthStatus;
  setSession: (session: AuthSession) => void;
  setUnauthenticated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: "checking",
  setSession: (session) => set({ session, status: "authenticated" }),
  setUnauthenticated: () => set({ session: null, status: "unauthenticated" }),
}));
