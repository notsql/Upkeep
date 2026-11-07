import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { AlertTriangle } from "lucide-react";
import { useCallback } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useEstateFailureRisk } from "@/lib/failure-risk";

import { RiskRow } from "@/routes/_auth/estates/$estateId/failure-risk/-components/failure-risk-page/risk-row";

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
