import { Link } from "@tanstack/react-router";
import { Hammer, Wrench } from "lucide-react";
import {
  SectionCard,
  sectionActionClassName,
} from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { AssetMaintenanceManualEntry } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-manual-entry";
import { AssetMaintenanceWorkEntry } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-work-entry";
import { useAssetMaintenanceSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance-section/use-asset-maintenance-section";

export function AssetMaintenanceSection({
  assetId,
  canRecord,
  estateId,
}: {
  assetId: string;
  canRecord: boolean;
  estateId: string;
}) {
  const {
    access,
    completions,
    entries,
    events,
    retryCompletions,
    retryEvents,
  } = useAssetMaintenanceSection(estateId, assetId);

  return (
    <SectionCard
      actions={
        canRecord ? (
          <Link
            className={sectionActionClassName}
            params={{ assetId, estateId }}
            to="/estates/$estateId/assets/$assetId/maintenance/new"
          >
            <Wrench aria-hidden="true" />
            Record repair
          </Link>
        ) : undefined
      }
      icon={Hammer}
      title="Maintenance"
    >
      <div className="grid gap-4">
        {events.isPending || completions.isPending ? (
          <LoadingState label="Loading maintenance…" rows={2} />
        ) : null}
        {events.error ? (
          <ErrorState message={events.error.message} onRetry={retryEvents} />
        ) : null}
        {completions.error ? (
          <ErrorState
            message={completions.error.message}
            onRetry={retryCompletions}
            retryLabel="Retry completed work"
          />
        ) : null}
        {events.data && completions.data && entries.length === 0 ? (
          <EmptyState
            description={
              canRecord
                ? "Use Record repair to add the first entry"
                : "Repairs and completed work orders appear here"
            }
            icon={Wrench}
            title="No maintenance recorded yet"
          />
        ) : null}
        {entries.length ? (
          <ul className="divide-y">
            {entries.map((entry) => (
              <li
                className="py-3 first:pt-0 last:pb-0"
                key={`${entry.kind}-${entry.id}`}
              >
                {entry.kind === "manual" ? (
                  <AssetMaintenanceManualEntry event={entry.event} />
                ) : (
                  <AssetMaintenanceWorkEntry
                    canView={access.canView}
                    estateId={estateId}
                    work={entry.work}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionCard>
  );
}
