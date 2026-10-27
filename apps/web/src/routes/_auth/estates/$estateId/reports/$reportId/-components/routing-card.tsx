import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  dispatchStatusLabel,
  equipmentLabel,
  type ReportRouting,
  routingStateLabel,
  useRetryDispatch,
  useRoutingAccess,
  workOrderStatusLabel,
} from "@/lib/report-routing";
import { DismissReportDialog } from "./dismiss-report-dialog";
import { SendToContractorDialog } from "./send-to-contractor-dialog";

const OUTCOMES = {
  EQUIPMENT_FAULT: "Equipment fault",
  INCONCLUSIVE: "Inconclusive",
  NOT_EQUIPMENT: "Not equipment",
} as const;

function assessment(
  classification: NonNullable<ReportRouting["classification"]>
): string {
  const parts: string[] = [OUTCOMES[classification.outcome]];
  if (classification.equipmentType) {
    parts.push(equipmentLabel(classification.equipmentType));
  }
  parts.push(`${Math.round(classification.confidence * 100)}% confidence`);
  return parts.join(" · ");
}

export function RoutingCard({
  estateId,
  reportId,
  routing,
}: {
  estateId: string;
  reportId: string;
  routing: ReportRouting;
}) {
  const { canManage, canViewWorkOrders } = useRoutingAccess(estateId);
  const retry = useRetryDispatch(estateId);
  const { workOrder } = routing;
  const dispatch = workOrder?.dispatch ?? null;
  const retrySend = useCallback(() => {
    if (workOrder) {
      retry.mutate(workOrder.id);
    }
  }, [retry, workOrder]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-semibold">Routing</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <Badge>{routingStateLabel(routing.state)}</Badge>
        </div>
        <dl className="grid gap-2 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
          {routing.reason ? (
            <>
              <dt className="text-muted-foreground">Reason</dt>
              <dd className="wrap-anywhere">{routing.reason}</dd>
            </>
          ) : null}
          {routing.classification ? (
            <>
              <dt className="text-muted-foreground">Model assessment</dt>
              <dd>{assessment(routing.classification)}</dd>
            </>
          ) : null}
          {workOrder ? (
            <>
              <dt className="text-muted-foreground">Work order</dt>
              <dd>
                {canViewWorkOrders ? (
                  <Link
                    params={{ estateId, workOrderId: workOrder.id }}
                    to="/estates/$estateId/work-orders/$workOrderId"
                  >
                    {workOrder.reference}
                  </Link>
                ) : (
                  workOrder.reference
                )}{" "}
                · {workOrderStatusLabel(workOrder.status)}
              </dd>
            </>
          ) : null}
          {dispatch ? (
            <>
              <dt className="text-muted-foreground">Contractor</dt>
              <dd className="wrap-anywhere">
                {dispatch.contractorName} ({dispatch.contractorEmail})
              </dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{dispatchStatusLabel(dispatch)}</dd>
              <dt className="text-muted-foreground">Approval</dt>
              <dd>
                {dispatch.approval === "AUTOMATIC"
                  ? "Sent automatically"
                  : "Approved by a manager"}
              </dd>
            </>
          ) : null}
        </dl>
        {canManage && routing.state === "NEEDS_REVIEW" ? (
          <div className="flex flex-wrap gap-2">
            <SendToContractorDialog
              estateId={estateId}
              reportId={reportId}
              suggested={routing.classification?.equipmentType ?? null}
            />
            <DismissReportDialog estateId={estateId} reportId={reportId} />
          </div>
        ) : null}
        {canManage && dispatch?.status === "FAILED" ? (
          <div>
            <Button
              disabled={retry.isPending}
              onClick={retrySend}
              variant="outline"
            >
              Retry sending
            </Button>
          </div>
        ) : null}
        {retry.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{retry.error.message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
