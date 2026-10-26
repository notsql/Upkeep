import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { useCallback, useId, useState } from "react";
import {
  type InspectionResult,
  useInspectionAccess,
  useInspectionAsset,
  useInspectionResults,
} from "@/lib/inspections";
import { useWorkOrderAccess } from "@/lib/work-orders";

interface InspectionHistoryRowProps {
  canCreateWorkOrder: boolean;
  canViewWorkOrder: boolean;
  record: InspectionResult;
}

function InspectionFollowUp({
  record,
  canCreateWorkOrder,
  canViewWorkOrder,
}: InspectionHistoryRowProps) {
  if (record.outcome === "PASS") {
    return <>Closed</>;
  }
  if (record.workOrder) {
    if (!canViewWorkOrder) {
      return <>{record.workOrder.reference}</>;
    }
    return (
      <Link
        className="underline underline-offset-4"
        params={{ estateId: record.estateId, workOrderId: record.workOrder.id }}
        to="/estates/$estateId/work-orders/$workOrderId"
      >
        {record.workOrder.reference}
      </Link>
    );
  }
  return canCreateWorkOrder ? (
    <Link
      className={buttonVariants({ size: "sm" })}
      params={{ estateId: record.estateId }}
      search={{ sourceInspectionId: record.id }}
      to="/estates/$estateId/work-orders/new"
    >
      Create work order
    </Link>
  ) : null;
}

function InspectionHistoryRow({
  record,
  canCreateWorkOrder,
  canViewWorkOrder,
}: InspectionHistoryRowProps) {
  return (
    <TableRow>
      <TableCell>{record.inspectedOn}</TableCell>
      <TableCell>
        <Badge
          variant={record.outcome === "PASS" ? "secondary" : "destructive"}
        >
          {record.outcome === "PASS" ? "Pass" : "Fail"}
        </Badge>
      </TableCell>
      <TableCell>
        <InspectionFollowUp
          canCreateWorkOrder={canCreateWorkOrder}
          canViewWorkOrder={canViewWorkOrder}
          record={record}
        />
      </TableCell>
      <TableCell>{record.recordedByName ?? "Inspector unavailable"}</TableCell>
      <TableCell>
        <Link
          className="underline underline-offset-4"
          params={{
            estateId: record.estateId,
            assetId: record.assetId,
            inspectionId: record.id,
          }}
          to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
        >
          View record
        </Link>
      </TableCell>
    </TableRow>
  );
}

function InspectionHistoryPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const headingId = useId();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const history = useInspectionResults(estateId, assetId, cursors.at(-1));
  const asset = useInspectionAsset(estateId, assetId);
  const workAccess = useWorkOrderAccess(estateId);
  const active = !!(
    asset.data?.estateActive &&
    asset.data.assetActive &&
    asset.data.locationActive
  );
  const nextCursor = history.data?.nextCursor;
  const next = useCallback(() => {
    if (nextCursor && !history.isFetching) {
      setCursors((current) => [...current, nextCursor]);
    }
  }, [nextCursor, history.isFetching]);
  const previous = useCallback(() => {
    setCursors((current) =>
      current.length > 1 ? current.slice(0, -1) : current
    );
  }, []);
  const retry = useCallback(() => history.refetch(), [history.refetch]);

  return (
    <section
      aria-labelledby={headingId}
      className="section-surface mt-6 min-w-0 max-w-full space-y-4"
    >
      <h2 className="font-semibold text-xl" id={headingId}>
        Inspection records
      </h2>
      {history.isPending ? (
        <p role="status">Loading inspection records…</p>
      ) : null}
      {history.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            {history.error.message}
            <Button
              disabled={history.isFetching}
              onClick={retry}
              variant="outline"
            >
              Retry inspections
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {history.data && history.data.items.length > 0 ? (
        <Table aria-label="Inspection records">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Inspection date</TableHead>
              <TableHead scope="col">Outcome</TableHead>
              <TableHead scope="col">Follow-up / work order</TableHead>
              <TableHead scope="col">Inspector</TableHead>
              <TableHead scope="col">View record</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.items.map((record) => (
              <InspectionHistoryRow
                canCreateWorkOrder={workAccess.canCreate && active}
                canViewWorkOrder={workAccess.canView}
                key={record.id}
                record={record}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
      {history.data?.items.length === 0 ? (
        <p role="status">No inspection records yet</p>
      ) : null}
      {asset.data && !active ? (
        <p role="note">
          New work orders are unavailable while the estate, asset or location is
          inactive or retired.
        </p>
      ) : null}
      {history.data?.items.length || cursors.length > 1 ? (
        <nav
          aria-label="Inspection history pages"
          className="flex flex-wrap gap-2"
        >
          <Button
            disabled={cursors.length === 1 || history.isFetching}
            onClick={previous}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={!nextCursor || history.isFetching}
            onClick={next}
            variant="outline"
          >
            Next
          </Button>
        </nav>
      ) : null}
    </section>
  );
}

export function InspectionHistoryTable({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const access = useInspectionAccess(estateId);
  if (!access.canView) {
    return null;
  }
  return (
    <InspectionHistoryPage
      assetId={assetId}
      estateId={estateId}
      key={`${access.userId}:${estateId}:${assetId}`}
    />
  );
}
