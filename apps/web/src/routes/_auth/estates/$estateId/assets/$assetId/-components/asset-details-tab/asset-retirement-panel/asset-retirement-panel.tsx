import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Archive, ScrollText } from "lucide-react";
import { useCallback, useState } from "react";
import { PageSection } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { type Asset, useAssetLifecycleEvents } from "@/lib/assets";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  badgeVariantFor,
  lifecycleActionTone,
  lifecycleTone,
} from "@/lib/status-tone";
import { Restoration } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/asset-retirement-panel/restoration";
import { RetirementEdit } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/asset-retirement-panel/retirement-edit";

function actionTone(action: string) {
  return Object.hasOwn(lifecycleActionTone, action)
    ? lifecycleActionTone[action as keyof typeof lifecycleActionTone]
    : undefined;
}

const actionLabels: Record<string, string> = {
  RETIRED: "Out of use",
  CORRECTED: "Out-of-use details changed",
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
    <PageSection icon={ScrollText} title="Lifecycle history">
      <div className="space-y-3">
        {asset.deactivatedAt ? (
          <>
            <dl>
              <dt>Date taken out of use</dt>
              <dd>
                {asset.retiredOn ? formatDate(asset.retiredOn) : "Not recorded"}
              </dd>
              <dt>Why it's out of use</dt>
              <dd className="whitespace-pre-wrap">
                {asset.retirementReason ?? "Not recorded"}
              </dd>
            </dl>
            <div className="flex flex-wrap gap-4">
              <Button onClick={openCorrection} variant="outline">
                Edit out-of-use details
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
          <EmptyState icon={Archive} title="No lifecycle events yet" />
        ) : null}
        <ol aria-label="Lifecycle events" className="divide-y">
          {history.data?.map((event) => (
            <li
              className="grid gap-1 py-3 text-sm first:pt-0 last:pb-0"
              key={event.id}
            >
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant={badgeVariantFor(actionTone(event.action))}>
                  {actionLabels[event.action] ?? event.action}
                </Badge>
                {event.occurredAt
                  ? formatDateTime(event.occurredAt, {
                      timeZone: "Asia/Singapore",
                    })
                  : "Not recorded"}{" "}
                (Singapore)
              </p>
              <p className="text-muted-foreground break-all">
                By {event.actorName ?? "an unknown user"}
              </p>
              {event.previousRetiredOn || event.previousRetirementReason ? (
                <p>
                  Previous out-of-use date:{" "}
                  {event.previousRetiredOn
                    ? formatDate(event.previousRetiredOn)
                    : "Not recorded"}{" "}
                  — {event.previousRetirementReason ?? "Not recorded"}
                </p>
              ) : null}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                Result:
                <Badge
                  variant={badgeVariantFor(
                    lifecycleTone[event.deactivatedAt ? "RETIRED" : "ACTIVE"]
                  )}
                >
                  {event.deactivatedAt ? "Out of use" : "Active"}
                </Badge>
                {event.deactivatedAt
                  ? `${event.retiredOn ? formatDate(event.retiredOn) : "Not recorded"} — ${event.retirementReason ?? "Not recorded"}`
                  : null}
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
    </PageSection>
  );
}
