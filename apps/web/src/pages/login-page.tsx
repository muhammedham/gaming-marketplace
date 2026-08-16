import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { login } from "../features/auth/auth-api";
import { ApiError } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      setSession(session);
      queryClient.setQueryData(["auth", "me"], session);
      const destination = (location.state as { from?: string } | null)?.from ?? "/profile";
      navigate(destination, { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  const errorMessage =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.isError
        ? "Unable to reach the server."
        : null;

  return (
    <>
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-gray-500">Access your marketplace account.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium" htmlFor="email">
          Email
          <Input
            className="mt-2"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium" htmlFor="password">
          Password
          <Input
            className="mt-2"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
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

        <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        New to the marketplace?{" "}
        <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/register">
          Create an account
        </Link>
      </p>
    </>
  );
}
