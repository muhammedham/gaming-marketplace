import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { register } from "../features/auth/auth-api";
import { ApiError } from "../lib/api-client";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import type { UserRole } from "../types/auth";

type RegisterRole = Exclude<UserRole, "ADMIN">;

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RegisterRole>("BUYER");
  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (session) => {
      setSession(session);
      queryClient.setQueryData(["auth", "me"], session);
      navigate("/profile", { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    registerMutation.mutate({ name, email, password, role });
  }

  const errorMessage =
    registerMutation.error instanceof ApiError
      ? registerMutation.error.message
      : registerMutation.isError
        ? "Unable to reach the server."
        : null;

  return (
    <>
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="mt-2 text-sm text-gray-500">Choose how you will use the marketplace.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <span className="block text-sm font-medium">Account type</span>
          <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Account type">
            {(["BUYER", "SELLER"] as RegisterRole[]).map((option) => (
              <button
                key={option}
                className={cn(
                  "h-10 rounded-md border text-sm font-semibold transition-colors",
                  role === option
                    ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
                )}
                type="button"
                aria-pressed={role === option}
                onClick={() => setRole(option)}
              >
                {option === "BUYER" ? "Buyer" : "Seller"}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm font-medium" htmlFor="name">
          Name
          <Input
            className="mt-2"
            id="name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium" htmlFor="register-email">
          Email
          <Input
            className="mt-2"
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium" htmlFor="register-password">
          Password
          <Input
            className="mt-2"
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {errorMessage ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <Button className="w-full" type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/login">
          Sign in
        </Link>
      </p>
    </>
  );
}
