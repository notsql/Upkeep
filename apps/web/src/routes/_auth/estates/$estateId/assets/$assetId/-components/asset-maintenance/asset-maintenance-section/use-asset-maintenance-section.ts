import { useCallback } from "react";
import { useAssetEvents } from "@/lib/asset-events";
import {
  useAssetWorkOrderCompletions,
  useWorkOrderAccess,
} from "@/lib/work-orders";

export type AssetWorkCompletion = NonNullable<
  ReturnType<typeof useAssetWorkOrderCompletions>["data"]
>[number];

export function useAssetMaintenanceSection(estateId: string, assetId: string) {
  const events = useAssetEvents(estateId, assetId);
  const completions = useAssetWorkOrderCompletions(estateId, assetId);
  const access = useWorkOrderAccess(estateId);
  const entries = [
    ...(events.data ?? []).map((event) => ({
      kind: "manual" as const,
      id: event.id,
      at: event.occurredOn,
      event,
    })),
    ...(completions.data ?? []).map((work) => ({
      kind: "work" as const,
      id: work.completion.id,
      at: work.completion.completedAt,
      work,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const retryEvents = useCallback(() => events.refetch(), [events.refetch]);
  const retryCompletions = useCallback(
    () => completions.refetch(),
    [completions.refetch]
  );

  return {
    access,
    completions,
    entries,
    events,
    retryCompletions,
    retryEvents,
  };
}
