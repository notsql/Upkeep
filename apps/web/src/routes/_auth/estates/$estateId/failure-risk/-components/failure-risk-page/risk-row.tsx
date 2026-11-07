import { Badge } from "@proj/ui/components/badge";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import {
  type FailureRisk,
  flagReasonLabel,
  formatProbability,
  noForecastReason,
  timeframeLabel,
} from "@/lib/failure-risk";

export function RiskRow({
  estateId,
  risk,
}: {
  estateId: string;
  risk: FailureRisk;
}) {
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
