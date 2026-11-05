import { Field, FieldLabel } from "@proj/ui/components/field";
import { Receipt } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { FilterBar } from "@/components/filter-bar";
import { LoadingState } from "@/components/loading-state";
import { SectionCard } from "@/components/section-card";
import { assetEventTypeLabel, useAssetEvents } from "@/lib/asset-events";
import {
  useAssetWorkOrderCompletions,
  useWorkOrderAccess,
} from "@/lib/work-orders";
import {
  type CostRow,
  CostTable,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/cost-table";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/date-range-picker";

/** A completion time as the viewer's local YYYY-MM-DD, like a date input. */
function localDate(iso: string): string {
  const at = new Date(iso);
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${at.getFullYear()}-${month}-${day}`;
}

export function AssetCostsSection({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
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

  return (
    <SectionCard icon={Receipt} title="Maintenance costs">
      <div className="grid gap-4">
        <div>
          <FilterBar
            activeCount={from || to ? 1 : 0}
            label="Filter costs"
            onClear={clearPeriod}
          >
            <Field className="w-full sm:w-72">
              <FieldLabel htmlFor={`${id}-period`}>Period</FieldLabel>
              <DateRangePicker
                id={`${id}-period`}
                onChange={setPeriod}
                value={period}
              />
            </Field>
          </FilterBar>
        </div>
        {events.isPending || completions.isPending ? (
          <LoadingState label="Loading costs…" rows={2} />
        ) : null}
        {events.error || completions.error ? (
          <ErrorState
            message={(events.error ?? completions.error)?.message ?? ""}
            onRetry={retry}
          />
        ) : null}
        {loaded && rows.length === 0 ? (
          <EmptyState
            description="Try a longer period"
            title="No costs in this period"
          />
        ) : null}
        {loaded && rows.length > 0 ? (
          <CostTable
            canView={Boolean(access.canView)}
            estateId={estateId}
            rows={rows}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
