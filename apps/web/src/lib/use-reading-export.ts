import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";
import { completeReadingCsv, saveReadingCsv } from "@/lib/reading-csv-download";
import type { ReadingSearch } from "@/lib/reading-filters";
import { readingFilterQuery } from "@/lib/readings";

export function useReadingExport(estateId: string, filters: ReadingSearch) {
  const { userId, ready } = useEstateSession();
  const access = useAppAccess();
  const allowed =
    ready &&
    !access.isError &&
    !!access.data?.estates.some(
      (e) => e.estateId === estateId && e.canViewReadings
    );
  const scope = `${estateId}:${userId}`;
  const active = useRef<{ controller: AbortController; scope: string } | null>(
    null
  );
  const [cancelled, setCancelled] = useState(false);
  const cancel = useCallback(() => {
    active.current?.controller.abort();
    active.current = null;
  }, []);
  useEffect(() => {
    if (active.current && (active.current.scope !== scope || !allowed)) {
      cancel();
    }
  }, [scope, allowed, cancel]);
  useEffect(() => cancel, [cancel]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async ({
      snapshot,
      controller,
    }: {
      snapshot: ReadingSearch;
      controller: AbortController;
    }) => {
      try {
        const { data, error, response } = await api.GET(
          "/estates/{estateId}/readings/export",
          {
            params: { path: { estateId }, query: readingFilterQuery(snapshot) },
            parseAs: "stream",
            signal: controller.signal,
          }
        );
        if (error || !data) {
          throw estateError(error, response.status);
        }
        const blob = await completeReadingCsv(
          data,
          response,
          controller.signal
        );
        if (
          active.current?.controller !== controller ||
          controller.signal.aborted
        ) {
          return;
        }
        saveReadingCsv(blob, response);
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof TypeError) {
          throw new Error(
            "Could not export readings. Check your connection and try again.",
            { cause: error }
          );
        }
        throw error instanceof Error
          ? error
          : new Error("Could not export readings. Please try again.", {
              cause: error,
            });
      } finally {
        if (active.current?.controller === controller) {
          active.current = null;
        }
      }
    },
  });
  const start = useCallback(() => {
    if (!allowed || active.current) {
      return;
    }
    setCancelled(false);
    const controller = new AbortController();
    active.current = { controller, scope };
    mutation.mutate({ snapshot: { ...filters }, controller });
  }, [allowed, filters, mutation.mutate, scope]);
  const cancelDownload = useCallback(() => {
    cancel();
    setCancelled(true);
  }, [cancel]);
  return { ...mutation, start, cancel: cancelDownload, cancelled, allowed };
}
