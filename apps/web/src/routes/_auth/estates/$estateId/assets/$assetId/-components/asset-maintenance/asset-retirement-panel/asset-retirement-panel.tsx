import { Button } from "@proj/ui/components/button";
import { ScrollText } from "lucide-react";
import { useCallback, useState } from "react";
import { SectionCard } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { type Asset, useAssetLifecycleEvents } from "@/lib/assets";
import { Restoration } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-retirement-panel/restoration";
import { RetirementEdit } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-retirement-panel/retirement-edit";

const actionLabels: Record<string, string> = {
  RETIRED: "Retired",
  CORRECTED: "Retirement corrected",
  RESTORED: "Restored",
};

export function AssetRetirementPanel({ asset }: { asset: Asset }) {
  const history = useAssetLifecycleEvents(asset.estateId, asset.id);
  const [mode, setMode] = useState<"restore" | "edit">();
  const closeDialog = useCallback(() => setMode(undefined), []);
  const retryHistory = useCallback(() => history.refetch(), [history]);
  const openRestoration = useCallback(() => setMode("restore"), []);
  const openCorrection = useCallback(() => setMode("edit"), []);
  return (
    <SectionCard icon={ScrollText} title="Lifecycle history">
      <div className="space-y-3">
        {asset.deactivatedAt ? (
          <>
            <dl>
              <dt>Retirement date</dt>
              <dd>{asset.retiredOn ?? "Not recorded"}</dd>
              <dt>Retirement reason</dt>
              <dd className="whitespace-pre-wrap">
                {asset.retirementReason ?? "Not recorded"}
              </dd>
            </dl>
            <div className="flex flex-wrap gap-4">
              <Button onClick={openCorrection} variant="outline">
                Edit retirement information
              </Button>
              <Button onClick={openRestoration}>Restore asset</Button>
            </div>
          </>
        ) : null}
        {history.isPending ? (
          <LoadingState label="Loading lifecycle history…" rows={2} />
        ) : null}
        {history.error ? (
          <ErrorState
            message={history.error.message}
            onRetry={retryHistory}
            retryLabel="Retry history"
          />
        ) : null}
        {history.data?.length === 0 ? (
          <EmptyState title="No lifecycle events yet" />
        ) : null}
        <ol aria-label="Lifecycle events" className="grid gap-3">
          {history.data?.map((event) => (
            <li
              className="grid gap-2 rounded-lg border p-3 text-sm"
              key={event.id}
            >
              <p>
                {actionLabels[event.action ?? ""] ?? event.action} ·{" "}
                {event.occurredAt
                  ? new Date(event.occurredAt).toLocaleString("en-SG", {
                      timeZone: "Asia/Singapore",
                    })
                  : "Not recorded"}{" "}
                (Singapore)
              </p>
              <p className="text-muted-foreground break-all">
                By {event.actorUserId}
              </p>
              <p>
                Previous retirement: {event.previousRetiredOn ?? "Not recorded"}{" "}
                — {event.previousRetirementReason ?? "Not recorded"}
              </p>
              <p>
                Result:{" "}
                {event.deactivatedAt
                  ? `${event.retiredOn ?? "Not recorded"} — ${event.retirementReason ?? "Not recorded"}`
                  : "Active"}
              </p>
            </li>
          ))}
        </ol>
        {mode === "edit" ? (
          <RetirementEdit asset={asset} onClose={closeDialog} />
        ) : null}
        {mode === "restore" ? (
          <Restoration asset={asset} onClose={closeDialog} />
        ) : null}
      </div>
    </SectionCard>
  );
}
