import { Badge } from "@proj/ui/components/badge";
import { Empty } from "@proj/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { useEstate } from "@/lib/estates";
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
  const estate = useEstate(estateId);
  const risks = useEstateFailureRisk(estateId);
  return (
    <main className="page-layout">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate.data?.name ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          { label: "Failure risk" },
        ]}
        description="Chance of a breakdown in the next 30, 60 and 90 days. Flagged assets need a check."
        title="Failure risk"
      />
      {risks.isPending ? (
        <p aria-live="polite" className="mt-6">
          Loading forecasts…
        </p>
      ) : null}
      {risks.error ? (
        <p className="mt-6 text-destructive" role="alert">
          {risks.error.message}
        </p>
      ) : null}
      {risks.data && risks.data.length === 0 ? (
        <Empty className="mt-6 border border-dashed bg-card" role="status">
          There are no assets to forecast in this estate yet.
        </Empty>
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
    </main>
  );
}
