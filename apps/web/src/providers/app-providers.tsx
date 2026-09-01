import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import { getCurrentSession } from "../features/auth/auth-api";
import { useAuthStore } from "../store/auth-store";

function AuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const sessionQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentSession,
    retry: false,
    staleTime: 60_000,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (sessionQuery.data) {
      setSession(sessionQuery.data);
    } else if (sessionQuery.isError) {
      setUnauthenticated();
    }
  }, [sessionQuery.data, sessionQuery.isError, setSession, setUnauthenticated]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: false },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      {children}
    </QueryClientProvider>
  );
}
