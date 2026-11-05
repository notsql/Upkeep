import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Hammer } from "lucide-react";
import { SectionCard } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { AssetMaintenanceManualEntry } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-manual-entry";
import { AssetMaintenanceWorkEntry } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-work-entry";
import { RecordEventDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance-section/record-event-dialog";
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
    cancel,
    completions,
    entries,
    events,
    open,
    recording,
    retryCompletions,
    retryEvents,
    save,
  } = useAssetMaintenanceSection(estateId, assetId);

  return (
    <SectionCard
      actions={
        canRecord ? (
          <Button onClick={open} variant="outline">
            Record repair
          </Button>
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
            title="No maintenance recorded yet"
          />
        ) : null}
        {entries.length ? (
          <ul className="grid gap-3">
            {entries.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`}>
                <Card size="sm">
                  <CardContent>
                    {entry.kind === "manual" ? (
                      <AssetMaintenanceManualEntry event={entry.event} />
                    ) : (
                      <AssetMaintenanceWorkEntry
                        canView={access.canView}
                        estateId={estateId}
                        work={entry.work}
                      />
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
        {recording && canRecord ? (
          <RecordEventDialog
            defaultType="BREAKDOWN_REPAIR"
            onCancel={cancel}
            onSave={save}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
