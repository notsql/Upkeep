import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import type { InspectionCheck } from "@/lib/inspection-list";
import { formatInterval } from "@/lib/service-intervals";
import { CheckAction } from "@/routes/_auth/estates/$estateId/inspections/-components/check-action";
import { StatusBadge } from "@/routes/_auth/estates/$estateId/inspections/-components/status-badge";

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function basis(check: InspectionCheck): string {
  if (check.dueBasis === "PREDICTION") {
    return "Predicted";
  }
  if (check.dueBasis === "NEVER_INSPECTED") {
    return "Never inspected";
  }
  const source = check.intervalSource === "ASSET" ? "asset" : "category";
  return `${formatInterval(check.interval)} (${source})`;
}

/** One block-and-level group of the monthly inspection list (ID-84, ID-86). */
export function CheckTable({
  checks,
  estateId,
  canRecord,
}: {
  checks: InspectionCheck[];
  estateId: string;
  canRecord: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Basis</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {checks.map((check) => (
          <TableRow key={check.id}>
            <TableCell>
              <Link
                className="underline"
                params={{ estateId, assetId: check.assetId }}
                to="/estates/$estateId/assets/$assetId"
              >
                {`${check.assetReference} · ${check.assetName}`}
              </Link>
            </TableCell>
            <TableCell>{check.categoryLabel}</TableCell>
            <TableCell>{formatDate(check.dueOn)}</TableCell>
            <TableCell>{basis(check)}</TableCell>
            <TableCell>
              <StatusBadge check={check} />
            </TableCell>
            <TableCell>
              <CheckAction
                canRecord={canRecord}
                check={check}
                estateId={estateId}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
