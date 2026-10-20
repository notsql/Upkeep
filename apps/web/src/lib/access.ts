import type { components } from "@proj/api/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export function useAuthenticatedSession() {
  const { user, loading } = useAuth();
  const client = useQueryClient();
  const previousId = useRef(user?.id);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const oldId = previousId.current;
    previousId.current = user?.id;
    if (oldId && oldId !== user?.id) {
      const filters = {
        predicate: (query: { queryKey: readonly unknown[] }) =>
          query.queryKey[0] === oldId || query.queryKey[1] === oldId,
      };
      client.cancelQueries(filters).then(() => client.removeQueries(filters));
    }
  }, [client, user?.id]);
  return { userId: user?.id, ready: mounted && !loading && !!user };
}

export function useAppAccess() {
  const { userId, ready } = useAuthenticatedSession();
  return useQuery({
    queryKey: [userId, "app-access"],
    enabled: ready,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({
      signal,
    }): Promise<components["schemas"]["AppAccessResponse"]> => {
      const { data, error } = await api.GET("/access/context", { signal });
      if (error || !data) {
        throw new Error("Unable to load your access. Please try again.");
      }
      return data;
    },
  });
}
