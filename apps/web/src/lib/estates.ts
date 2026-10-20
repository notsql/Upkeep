import type { components, operations } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { dashboardQueryKey } from "@/lib/dashboard";

const INTERNAL_ERROR =
  /jooq|sql|exception|org\.(?:postgresql|springframework)|stack trace/i;

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
  if (status >= 500 && INTERNAL_ERROR.test(error?.message ?? "")) {
    return new Error(
      "The service is temporarily unavailable. Please try again."
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

export function useSaveEstate(
  estateId: string | undefined,
  onSaved: (estate: components["schemas"]["EstateResponse"]) => Promise<void>
) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  const [createdEstate, setCreatedEstate] =
    useState<components["schemas"]["EstateResponse"]>();
  const refreshAccess = useMutation({
    mutationFn: async (data: components["schemas"]["EstateResponse"]) => {
      await queryClient.cancelQueries({
        queryKey: [userId, "app-access"],
        exact: true,
      });
      await queryClient.refetchQueries(
        { queryKey: [userId, "app-access"], exact: true },
        { throwOnError: true }
      );
      await onSaved(data);
    },
  });
  const save = useMutation({
    mutationFn: async (body: components["schemas"]["EstateRequest"]) => {
      const { data, error, response } = estateId
        ? await api.PATCH("/estates/{id}", {
            params: { path: { id: estateId } },
            body,
          })
        : await api.POST("/estates", { body });
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      if (!estateId) {
        setCreatedEstate(data);
      }
      queryClient.setQueryData(["estates", userId, "details", data.id], data);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["estates", userId, "list"],
        }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId) }),
      ]);
      if (estateId) {
        await onSaved(data);
        return;
      }
      // Creation committed; refresh failures have their own visible retry state.
      await refreshAccess.mutateAsync(data).catch(() => undefined);
    },
  });
  return { ...save, createdEstate, refreshAccess };
}
