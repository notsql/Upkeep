import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import {
  flagReasonLabel,
  formatProbability,
  noForecastReason,
  timeframeLabel,
  useAssetFailureRisk,
} from "@/lib/failure-risk";

export function AssetForecastCard({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const risk = useAssetFailureRisk(estateId, assetId);
  const reason = risk.data ? noForecastReason(risk.data) : null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          <h2>Breakdown forecast</h2>
        </CardTitle>
        <CardDescription>
          Chance of a breakdown, from this unit's maintenance history.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {risk.isPending ? <p aria-live="polite">Loading forecast…</p> : null}
        {risk.error ? (
          <Alert variant="destructive">
            <AlertDescription>{risk.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {risk.data ? (
          <>
            {risk.data.flagReasons.length ? (
              <p className="mb-3 flex flex-wrap items-center gap-1">
                Flagged for a check:
                {risk.data.flagReasons.map((flag) => (
                  <Badge key={flag} variant="destructive">
                    {flagReasonLabel[flag]}
                  </Badge>
                ))}
              </p>
            ) : null}
            {reason ? (
              <p className="text-muted-foreground">{reason}</p>
            ) : (
              <dl className="detail-grid">
                <div>
                  <dt className="font-medium">Within 30 days</dt>
                  <dd>{formatProbability(risk.data.probability30Days)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Within 60 days</dt>
                  <dd>{formatProbability(risk.data.probability60Days)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Within 90 days</dt>
                  <dd>{formatProbability(risk.data.probability90Days)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Recommended check</dt>
                  <dd>
                    {risk.data.recommendedTimeframe
                      ? timeframeLabel[risk.data.recommendedTimeframe]
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Breakdowns observed</dt>
                  <dd>{risk.data.failuresObserved}</dd>
                </div>
              </dl>
            )}
            <p className="mt-3">
              Expected end of life:{" "}
              {risk.data.expectedEndOfLife ?? "Not recorded"}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
