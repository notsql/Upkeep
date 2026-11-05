import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import {
  type FailureRisk,
  flagReasonLabel,
  formatProbability,
  noForecastReason,
  timeframeLabel,
  useEstateFailureRisk,
} from "@/lib/failure-risk";

function RiskRow({ estateId, risk }: { estateId: string; risk: FailureRisk }) {
  const reason = noForecastReason(risk);
  return (
    <TableRow>
      <TableCell>
        <Link
          className="font-medium underline"
          params={{ estateId, assetId: risk.assetId }}
          to="/estates/$estateId/assets/$assetId"
        >
          {risk.assetName}
        </Link>
      </TableCell>
      <TableCell>{risk.assetReference}</TableCell>
      {reason ? (
        <TableCell className="text-muted-foreground" colSpan={4}>
          {reason}
        </TableCell>
      ) : (
        <>
          <TableCell>{formatProbability(risk.probability30Days)}</TableCell>
          <TableCell>{formatProbability(risk.probability60Days)}</TableCell>
          <TableCell>{formatProbability(risk.probability90Days)}</TableCell>
          <TableCell>
            {risk.recommendedTimeframe
              ? timeframeLabel[risk.recommendedTimeframe]
              : "—"}
          </TableCell>
        </>
      )}
      <TableCell>{risk.expectedEndOfLife ?? "Not recorded"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {risk.flagReasons.map((flag) => (
            <Badge key={flag} variant="destructive">
              {flagReasonLabel[flag]}
            </Badge>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function FailureRiskPage({ estateId }: { estateId: string }) {
  const risks = useEstateFailureRisk(estateId);
  return (
    <PageLayout>
      <PageHeader
        description="Chance of a breakdown in the next 30, 60 and 90 days. Flagged assets need a check."
        title="Failure risk"
      />
      {risks.isPending ? (
        <div className="mt-6">
          <LoadingState label="Loading forecasts…" variant="table" />
        </div>
      ) : null}
      {risks.error ? (
        <Alert className="mt-6" variant="destructive">
          <AlertDescription>{risks.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {risks.data && risks.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            description="Forecasts appear once assets are added to this estate."
            icon={Gauge}
            title="There are no assets to forecast in this estate yet."
          />
        </div>
      ) : null}
      {risks.data?.length ? (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>30 days</TableHead>
              <TableHead>60 days</TableHead>
              <TableHead>90 days</TableHead>
              <TableHead>Check</TableHead>
              <TableHead>End of life</TableHead>
              <TableHead>Flags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.data.map((risk) => (
              <RiskRow estateId={estateId} key={risk.assetId} risk={risk} />
            ))}
          </TableBody>
        </Table>
      ) : null}
    </PageLayout>
  );
}
