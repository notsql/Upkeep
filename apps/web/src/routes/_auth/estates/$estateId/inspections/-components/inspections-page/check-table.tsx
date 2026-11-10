import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@proj/ui/components/item";
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
import { useInspectionAccess } from "@/lib/inspections";
import { formatInterval } from "@/lib/service-intervals";
import { useMobile } from "@/lib/use-mobile";
import { CheckAction } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/check-action";
import { EndOfLifeAction } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/end-of-life-action";
import { StatusBadge } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/status-badge";

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function basis(check: InspectionCheck): string {
  if (check.dueBasis === "REQUESTED") {
    const by = check.requestedByName ? ` by ${check.requestedByName}` : "";
    return `Sent to ${check.assignedToName ?? "someone"}${by}`;
  }
  if (check.dueBasis === "PREDICTION") {
    return "Expected";
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
  const canSend = Boolean(useInspectionAccess(estateId).canCreateWorkOrders);
  const mobile = useMobile();
  if (mobile) {
    return (
      <ul aria-label="Checks" className="flex min-w-0 flex-col">
        {checks.map((check, index) => (
          <li key={check.id}>
            {index > 0 ? <ItemSeparator className="my-0" /> : null}
            <Item size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle className="line-clamp-none w-full items-start justify-between [overflow-wrap:anywhere]">
                  <Link
                    className="underline"
                    params={{ estateId, assetId: check.assetId }}
                    to="/estates/$estateId/assets/$assetId"
                  >
                    {check.assetName}
                  </Link>
                  <StatusBadge check={check} />
                </ItemTitle>
                <ItemDescription className="text-xs">{`${check.assetReference} · ${check.categoryLabel}`}</ItemDescription>
                <ItemDescription className="text-xs">{`Due ${formatDate(check.dueOn)} · ${basis(check)}`}</ItemDescription>
              </ItemContent>
              <ItemActions className="w-full justify-end">
                {canSend && !check.result && check.dueBasis === "PREDICTION" ? (
                  <EndOfLifeAction check={check} estateId={estateId} />
                ) : null}
                <CheckAction
                  canRecord={canRecord}
                  check={check}
                  estateId={estateId}
                />
              </ItemActions>
            </Item>
          </li>
        ))}
      </ul>
    );
  }
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canSend && !check.result && check.dueBasis === "PREDICTION" ? (
                  <EndOfLifeAction check={check} estateId={estateId} />
                ) : null}
                <CheckAction
                  canRecord={canRecord}
                  check={check}
                  estateId={estateId}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
