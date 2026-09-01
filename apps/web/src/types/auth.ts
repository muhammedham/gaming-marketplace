export type UserRole = "BUYER" | "SELLER" | "ADMIN";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: "ACTIVE" | "SUSPENDED";
}

export interface WalletSummary {
  availableBalance: string;
  heldBalance: string;
  currency: "COIN";
}

export interface AuthSession {
  user: AuthUser;
  wallet: WalletSummary;
}
