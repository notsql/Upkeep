import { Badge } from "@proj/ui/components/badge";
import { Card, CardContent } from "@proj/ui/components/card";
import { BellRing } from "lucide-react";
import { AlertResponseActions } from "@/components/notifications/alert-response-actions";
import { AlertResponseSummary } from "@/components/notifications/alert-response-summary";
import { UNUSUAL_READINGS_STEP } from "@/components/notifications/unusual-readings-step";
import { SectionCard } from "@/components/page/section-card";
import { ErrorState } from "@/components/states/error-state";
import { type Notification, useAssetAnomalyAlerts } from "@/lib/notifications";
import { ConditionBadge } from "@/routes/_auth/estates/$estateId/assets/-components/condition-badge";

function time(iso: string) {
  return new Date(iso).toLocaleString();
}

function AnomalyAlertItem({
  alert,
  locked,
}: {
  alert: Notification;
  locked?: string;
}) {
  const { anomaly } = alert;
  if (!anomaly) {
    return null;
  }
  return (
    <li>
      <Card size="sm">
        <CardContent className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ConditionBadge condition={anomaly.condition} />
            <Badge variant={alert.resolvedAt ? "outline" : "default"}>
              {alert.resolvedAt ? "Resolved" : "Open"}
            </Badge>
          </div>
          <p className="text-sm whitespace-pre-wrap">{anomaly.explanation}</p>
          <p className="text-muted-foreground text-sm">
            {`Unusual from ${time(anomaly.firstDetectedAt)} to ${time(anomaly.lastDetectedAt)}`}
          </p>
          {anomaly.response === "NONE" && !alert.resolvedAt ? (
            <p className="text-sm">{UNUSUAL_READINGS_STEP}</p>
          ) : null}
          <AlertResponseSummary anomaly={anomaly} />
          <AlertResponseActions alert={alert} locked={locked} />
        </CardContent>
      </Card>
    </li>
  );
}

/** The asset's anomaly alerts and how managers responded (ID-107). */
export function AnomalyAlertsSection({
  estateId,
  assetId,
  locked,
}: {
  estateId: string;
  assetId: string;
  /** Why acknowledging and dismissing are unavailable, if they are. */
  locked?: string;
}) {
  const alerts = useAssetAnomalyAlerts(estateId, assetId);
  // Only an error or at least one alert earns the card; loading shows nothing
  // so the page never flashes a card that then disappears.
  if (!(alerts.error || alerts.data?.length)) {
    return null;
  }
  return (
    <SectionCard
      description="Warnings about readings that don't look normal"
      icon={BellRing}
      title="Unusual readings"
    >
      {alerts.error ? (
        <ErrorState message={alerts.error.message} onRetry={alerts.refetch} />
      ) : null}
      {alerts.data && alerts.data.length > 0 ? (
        <ul className="grid gap-3">
          {alerts.data.map((alert) => (
            <AnomalyAlertItem alert={alert} key={alert.id} locked={locked} />
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}
