"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 0,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      {children}
    </QueryClientProvider>
  );
}

function AuthBootstrap() {
  const { hasHydrated, token, user } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated || !token || user) {
      return;
    }

    authApi
      .me()
      .then((res) => {
        const currentUser = res.data as User;
        useAuthStore.setState({
          user: currentUser,
          token,
          isAuthenticated: true,
        });
      })
      .catch(() => {
        // Keep the session state stable here. The request interceptor handles real invalid-token cases.
      });
  }, [hasHydrated, token, user]);

  return null;
}
