import type { components, operations } from "@proj/api/schema";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type EstateStatus = NonNullable<
  NonNullable<operations["list"]["parameters"]["query"]>["status"]
>;

// Wait until browser effects have installed the AuthTokenBridge resolver.
// Never fetch owner data during SSR or while AuthKit is restoring a session.
export function useEstateSession() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return { userId: user?.id, ready: mounted && !loading && Boolean(user) };
}

export function estateError(
  error: components["schemas"]["EstateError"] | undefined,
  status: number
): Error {
  if (status === 401) {
    return new Error(
      "We could not verify your sign-in. Please try signing in again."
    );
  }
  return new Error(
    error?.message ?? "Unable to complete the estate request. Please try again."
  );
}

export function useEstate(estateId?: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: ["estates", userId, "details", estateId],
    enabled: ready && Boolean(estateId),
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/estates/{id}", {
        params: { path: { id: estateId ?? "" } },
      });
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useEstateList(status: EstateStatus) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: ["estates", userId, "list", status],
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/estates", {
        params: { query: { status } },
      });
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}
