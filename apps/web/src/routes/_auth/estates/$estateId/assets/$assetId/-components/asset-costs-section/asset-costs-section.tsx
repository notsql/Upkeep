import { Field, FieldLabel } from "@proj/ui/components/field";
import { Receipt } from "lucide-react";
import { FilterBar } from "@/components/filters/filter-bar";
import { SectionCard } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { CostTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-costs-section/cost-table";
import { DateRangePicker } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-costs-section/date-range-picker";
import { useAssetCostsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-costs-section/use-asset-costs-section";

export function AssetCostsSection({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const {
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
  } = useAssetCostsSection(estateId, assetId);

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
