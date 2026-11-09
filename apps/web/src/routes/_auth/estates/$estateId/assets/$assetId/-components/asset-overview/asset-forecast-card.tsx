import { Alert, AlertDescription } from "@proj/ui/components/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Progress } from "@proj/ui/components/progress";
import { cn } from "@proj/ui/lib/utils";
import { TrendingDown, TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import { SectionHeading } from "@/components/page/section-heading";
import { LoadingState } from "@/components/states/loading-state";
import {
  ANOMALY_MODEL_USER_ID,
  type Assessment,
  conditionLabel,
  recorderName,
  useAssessments,
} from "@/lib/assessments";
import {
  type FailureRisk,
  type FlagReason,
  flagReasonLabel,
  formatProbability,
  noForecastReason,
  type RiskLevel,
  riskLevel,
  riskLevelLabel,
  timeframeLabel,
  useAssetFailureRisk,
} from "@/lib/failure-risk";
import { formatDate } from "@/lib/format";

/** CONDITION names the current condition and its recorder once assessments load. */
function reasonText(flag: FlagReason, current: Assessment | undefined): string {
  if (flag !== "CONDITION") {
    return flagReasonLabel[flag];
  }
  if (!current) {
    return "Condition needs a check";
  }
  const condition = `Condition: ${conditionLabel[current.condition]}`;
  const known =
    current.recordedByUserId === ANOMALY_MODEL_USER_ID ||
    Boolean(current.recordedByName);
  return known ? `${condition} · ${recorderName(current)}` : condition;
}

const HORIZONS = [
  ["30 days", "probability30Days"],
  ["60 days", "probability60Days"],
  ["90 days", "probability90Days"],
] as const;

/** Text and bar colour per risk level, light and dark. */
const TONES: Record<RiskLevel, { tone: string; text: string; bar: string }> = {
  LOW: {
    tone: "low",
    text: "text-success",
    bar: "[&_[data-slot=progress-indicator]]:bg-success",
  },
  MODERATE: {
    tone: "moderate",
    text: "text-warning",
    bar: "[&_[data-slot=progress-indicator]]:bg-warning",
  },
  HIGH: {
    tone: "high",
    text: "text-destructive",
    bar: "[&_[data-slot=progress-indicator]]:bg-destructive",
  },
};

/** Risk headline, the recommended check, then 30/60/90 bars. */
function ForecastFigures({ risk }: { risk: FailureRisk }) {
  const level = riskLevel(risk.probability90Days ?? 0);
  const tone = TONES[level];
  return (
    <>
      <figure
        aria-label="Forecast"
        className="grid gap-3"
        data-tone={tone.tone}
      >
        <div className="grid gap-0.5">
          <span className={cn("text-sm font-semibold", tone.text)}>
            {riskLevelLabel[level]}
          </span>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={cn("text-4xl font-semibold tabular-nums", tone.text)}
            >
              {formatProbability(risk.probability90Days)}
            </span>
            <span className="text-muted-foreground text-xs">
              chance of a breakdown within 90 days
            </span>
          </p>
        </div>
        <p className="bg-muted/50 flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg px-3 py-2">
          <span className="text-muted-foreground text-xs">
            Recommended check
          </span>
          <span className="font-medium">
            {risk.recommendedTimeframe
              ? timeframeLabel[risk.recommendedTimeframe]
              : "—"}
          </span>
        </p>
      </figure>
      <ul aria-label="Chance by horizon" className="grid grid-cols-3 gap-4">
        {HORIZONS.map(([label, key]) => (
          <li className="grid gap-1.5" key={key}>
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-xs">{label}</span>
              <span className="text-xs font-medium tabular-nums">
                {formatProbability(risk[key])}
              </span>
            </span>
            <Progress
              aria-label={`Chance within ${label}`}
              className={tone.bar}
              value={Math.round((risk[key] ?? 0) * 100)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

export function AssetForecastCard({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const risk = useAssetFailureRisk(estateId, assetId);
  // Already cached by the Condition card; the API returns the current one first.
  const current = useAssessments(estateId, assetId).data?.[0];
  const reason = risk.data ? noForecastReason(risk.data) : null;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <SectionHeading icon={TrendingDown}>
            Breakdown forecast
          </SectionHeading>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {risk.isPending ? (
          <LoadingState label="Loading forecast…" rows={2} />
        ) : null}
        {risk.error ? (
          <Alert variant="destructive">
            <AlertDescription>{risk.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {risk.data ? (
          <>
            {reason ? (
              <p className="text-muted-foreground">{reason}</p>
            ) : (
              <ForecastFigures risk={risk.data} />
            )}
            {risk.data.flagReasons.length ? (
              <p className="text-muted-foreground flex items-start gap-1.5">
                <TriangleAlert
                  aria-hidden="true"
                  className="text-warning mt-0.5 size-3.5 shrink-0"
                />
                <span>
                  Flagged for a check because{" "}
                  {risk.data.flagReasons.map((flag, index) => (
                    <Fragment key={flag}>
                      {index ? ", " : null}
                      <span className="text-foreground">
                        {reasonText(flag, current)}
                      </span>
                    </Fragment>
                  ))}
                </span>
              </p>
            ) : null}
            <p className="text-muted-foreground mt-auto flex flex-wrap gap-x-2 text-xs">
              <span>Breakdowns observed: {risk.data.failuresObserved}</span>
              <span aria-hidden="true">·</span>
              <span>
                Expected end of life:{" "}
                {risk.data.expectedEndOfLife
                  ? formatDate(risk.data.expectedEndOfLife)
                  : "Not recorded"}
              </span>
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
