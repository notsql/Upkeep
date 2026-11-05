import { useCallback, useId, useState } from "react";
import { assetEventTypeLabel, useAssetEvents } from "@/lib/asset-events";
import {
  useAssetWorkOrderCompletions,
  useWorkOrderAccess,
} from "@/lib/work-orders";
import type { CostRow } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/cost-table";
import type { DateRangeValue } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/date-range-picker";

/** A completion time as the viewer's local YYYY-MM-DD, like a date input. */
function localDate(iso: string): string {
  const at = new Date(iso);
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${at.getFullYear()}-${month}-${day}`;
}

export function useAssetCostsSection(estateId: string, assetId: string) {
  const id = useId();
  const events = useAssetEvents(estateId, assetId);
  const completions = useAssetWorkOrderCompletions(estateId, assetId);
  const access = useWorkOrderAccess(estateId);
  const [period, setPeriod] = useState<DateRangeValue>({ from: "", to: "" });
  const retry = useCallback(() => {
    events.refetch();
    completions.refetch();
  }, [events.refetch, completions.refetch]);
  const clearPeriod = useCallback(() => setPeriod({ from: "", to: "" }), []);
  const { from, to } = period;
  const rows: CostRow[] = [
    ...(events.data ?? []).map((event) => ({
      at: event.occurredOn,
      date: event.occurredOn,
      id: event.id,
      label: assetEventTypeLabel[event.type],
      labour: event.labourCost ?? null,
      parts: event.partsCost ?? null,
      other: event.otherCost ?? null,
      total: event.totalCost ?? null,
    })),
    ...(completions.data ?? []).map((work) => ({
      at: work.completion.completedAt,
      date: localDate(work.completion.completedAt),
      id: work.completion.id,
      label: work.reference,
      labour: work.completion.labourCost ?? null,
      parts: work.completion.partsCost ?? null,
      total: work.completion.totalCost ?? null,
      workOrder: { id: work.workOrderId, reference: work.reference },
    })),
  ]
    // ISO dates compare correctly as strings.
    .filter((row) => !((from && row.date < from) || (to && row.date > to)))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const loaded = Boolean(events.data && completions.data);

  return {
    access,
    clearPeriod,
    completions,
    events,
    from,
    id,
    loaded,
    period,
    retry,
    rows,
    setPeriod,
    to,
  };
}
