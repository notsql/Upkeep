import { Badge } from "@proj/ui/components/badge";
import { buttonVariants } from "@proj/ui/components/button";
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

const DUE_BADGE =
  "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200";
const DONE_BADGE =
  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";

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

function StatusBadge({ check }: { check: InspectionCheck }) {
  if (check.status === "OVERDUE") {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  if (check.status === "DUE") {
    return (
      <Badge className={DUE_BADGE} variant="outline">
        Due
      </Badge>
    );
  }
  return (
    <Badge className={DONE_BADGE} variant="outline">
      {`Done · ${check.result?.outcome === "FAIL" ? "Fail" : "Pass"}`}
    </Badge>
  );
}

function Action({
  check,
  estateId,
  canRecord,
}: {
  check: InspectionCheck;
  estateId: string;
  canRecord: boolean;
}) {
  if (check.result) {
    return (
      <Link
        className={buttonVariants({ size: "sm", variant: "outline" })}
        params={{
          estateId,
          assetId: check.assetId,
          inspectionId: check.result.id,
        }}
        to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
      >
        View result
      </Link>
    );
  }
  if (!canRecord) {
    return null;
  }
  return (
    <Link
      className={buttonVariants({ size: "sm" })}
      params={{ estateId, assetId: check.assetId }}
      to="/estates/$estateId/assets/$assetId/inspections/new"
    >
      Record inspection
    </Link>
  );
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
              <Action canRecord={canRecord} check={check} estateId={estateId} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
