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
import { AlertTriangle } from "lucide-react";
import { useCallback } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { ListPageHeader } from "@/components/page-header";
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
  const retry = useCallback(() => risks.refetch(), [risks.refetch]);
  return (
    <PageLayout className="space-y-6">
      <ListPageHeader
        description="Breakdown odds over 30, 60 and 90 days"
        icon={AlertTriangle}
        title="Failure risk"
      />
      {risks.isPending ? (
        <LoadingState label="Loading forecasts…" variant="table" />
      ) : null}
      {risks.error ? (
        <ErrorState message={risks.error.message} onRetry={retry} />
      ) : null}
      {risks.data && risks.data.length === 0 ? (
        <EmptyState
          description="Forecasts appear once assets are added"
          title="No assets to forecast yet"
        />
      ) : null}
      {risks.data?.length ? (
        <Table>
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
