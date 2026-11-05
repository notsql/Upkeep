import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  type AssetEventInput,
  useAssetEvents,
  useRecordAssetEvent,
} from "@/lib/asset-events";
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
  const recordEvent = useRecordAssetEvent(estateId, assetId);
  const [recording, setRecording] = useState(false);
  const retryEvents = useCallback(() => events.refetch(), [events.refetch]);
  const retryCompletions = useCallback(
    () => completions.refetch(),
    [completions.refetch]
  );
  const open = useCallback(() => setRecording(true), []);
  const cancel = useCallback(() => setRecording(false), []);
  const save = useCallback(
    async (values: AssetEventInput) => {
      await recordEvent.mutateAsync(values);
      setRecording(false);
      toast.success("Event recorded.");
    },
    [recordEvent.mutateAsync]
  );

  return {
    access,
    cancel,
    completions,
    entries,
    events,
    open,
    recording,
    retryCompletions,
    retryEvents,
    save,
  };
}
