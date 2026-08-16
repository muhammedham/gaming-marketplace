import { apiRequest } from "../../lib/api-client";
import type { AuthSession, UserRole } from "../../types/auth";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
  role: Exclude<UserRole, "ADMIN">;
}

export function login(input: LoginInput) {
  return apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function register(input: RegisterInput) {
  return apiRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCurrentSession() {
  return apiRequest<AuthSession>("/auth/me");
}

export function logout() {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}
