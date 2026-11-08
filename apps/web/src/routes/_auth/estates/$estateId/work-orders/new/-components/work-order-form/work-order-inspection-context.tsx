import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DetailCard } from "@/components/page/detail-card";
import { FormCard } from "@/components/page/form-page";
import { LoadingState } from "@/components/states/loading-state";
import { InspectionSourceLink } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/inspection-source-link";
import type { useWorkOrderInspection } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/use-work-order-inspection";

export function renderInspectionWorkOrderStatus(
  inspection: ReturnType<typeof useWorkOrderInspection>,
  reloadSource: () => Promise<void>
): ReactNode {
  if (inspection.failed) {
    return (
      <FormCard>
        <div className="grid justify-items-start gap-4">
          <p role="alert">Source inspection or asset context is unavailable.</p>
          <Button onClick={reloadSource} variant="outline">
            Retry source
          </Button>
        </div>
      </FormCard>
    );
  }
  if (inspection.pending) {
    return <LoadingState label="Loading source inspection…" rows={2} />;
  }
  const { record } = inspection;
  if (record?.workOrder) {
    return (
      <FormCard title="Work order already raised">
        <div className="grid justify-items-start gap-3">
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
        </div>
      </FormCard>
    );
  }
  if (record && record.outcome !== "FAIL") {
    return (
      <FormCard>
        <div className="grid justify-items-start gap-3">
          <p role="alert">
            Only a failed inspection can be converted to a work order.
          </p>
          <InspectionSourceLink record={record} />
        </div>
      </FormCard>
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
            <DetailCard>
              <div>
                <dt>Recorded inspection location</dt>
                <dd>{inspection.record.locationPath}</dd>
              </div>
              <div>
                <dt>Current work location</dt>
                <dd>{inspection.asset.locationPath}</dd>
              </div>
            </DetailCard>
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
