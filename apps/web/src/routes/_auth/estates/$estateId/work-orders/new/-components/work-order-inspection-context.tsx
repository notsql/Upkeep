import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { InspectionResult } from "@/lib/inspections";
import type { useWorkOrderInspection } from "./use-work-order-inspection";

function InspectionSourceLink({ record }: { record: InspectionResult }) {
  return (
    <Link
      className="underline underline-offset-4"
      params={{
        estateId: record.estateId,
        assetId: record.assetId,
        inspectionId: record.id,
      }}
      to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
    >
      Back to inspection
    </Link>
  );
}

export function renderInspectionWorkOrderStatus(
  inspection: ReturnType<typeof useWorkOrderInspection>,
  reloadSource: () => Promise<void>
): ReactNode {
  if (inspection.failed) {
    return (
      <main className="page-layout space-y-4">
        <p role="alert">Source inspection or asset context is unavailable.</p>
        <Button onClick={reloadSource} variant="outline">
          Retry source
        </Button>
      </main>
    );
  }
  if (inspection.pending) {
    return <p role="status">Loading source inspection…</p>;
  }
  const { record } = inspection;
  if (record?.workOrder) {
    return (
      <main className="page-layout space-y-4">
        <h1 className="font-semibold text-2xl">Work order already raised</h1>
        <Link
          className="underline"
          params={{
            estateId: record.estateId,
            workOrderId: record.workOrder.id,
          }}
          to="/estates/$estateId/work-orders/$workOrderId"
        >
          {record.workOrder.reference}
        </Link>
        <InspectionSourceLink record={record} />
      </main>
    );
  }
  if (record && record.outcome !== "FAIL") {
    return (
      <main className="page-layout space-y-4">
        <p role="alert">
          Only a failed inspection can be converted to a work order.
        </p>
        <InspectionSourceLink record={record} />
      </main>
    );
  }
  return null;
}

export function WorkOrderInspectionContext({
  inspection,
}: {
  inspection: ReturnType<typeof useWorkOrderInspection>;
}) {
  if (!(inspection.record && inspection.asset)) {
    return null;
  }
  return (
    <>
      {inspection.active ? null : (
        <p role="alert">
          Work-order creation is unavailable because the estate, asset or
          location is inactive or retired. The failed inspection remains saved.
        </p>
      )}
      {!inspection.confirmed && inspection.active ? (
        <Alert>
          <AlertDescription>
            Review the recorded and current asset locations before continuing.
            <dl className="detail-grid">
              <div>
                <dt>Recorded inspection location</dt>
                <dd>{inspection.record.locationPath}</dd>
              </div>
              <div>
                <dt>Current work location</dt>
                <dd>{inspection.asset.locationPath}</dd>
              </div>
            </dl>
          </AlertDescription>
          <Button
            disabled={inspection.reloading}
            onClick={inspection.confirmLocation}
            type="button"
            variant="outline"
          >
            Use current asset location
          </Button>
        </Alert>
      ) : null}
    </>
  );
}
