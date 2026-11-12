import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { SectionCard } from "@/components/page/section-card";
import {
  CATEGORY_CONTRACTOR_TYPE,
  dispatchStatusLabel,
  explainReason,
  type ReportRouting,
  useRetryDispatch,
  useRoutingAccess,
  workOrderStatusLabel,
} from "@/lib/report-routing";
import { DismissReportDialog } from "./dismiss-report-dialog";
import { SendToContractorDialog } from "./send-to-contractor-dialog";

function Reason({
  estateId,
  reason,
  canManage,
}: {
  estateId: string;
  reason: string;
  canManage: boolean;
}) {
  const explained = explainReason(reason);
  return (
    <p className="wrap-anywhere">
      {explained.text}
      {explained.missingContractor && canManage ? (
        <>
          {" "}
          <Link params={{ estateId }} to="/estates/$estateId/contractors">
            Set one up
          </Link>
        </>
      ) : null}
    </p>
  );
}

function suggestedType(routing: ReportRouting) {
  const category = routing.classification?.category;
  return category
    ? CATEGORY_CONTRACTOR_TYPE[category]
    : (routing.classification?.equipmentType ?? null);
}

function WorkOrderDetails({
  estateId,
  routing,
}: {
  estateId: string;
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
  if (!workOrder) {
    return null;
  }
  return (
    <>
      <dl className="grid gap-2 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
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
    </>
  );
}

function Body({
  estateId,
  reportId,
  routing,
}: {
  estateId: string;
  reportId: string;
  routing: ReportRouting;
}) {
  const { canManage } = useRoutingAccess(estateId);
  if (routing.state === "CLASSIFYING") {
    return (
      <>
        <p className="font-medium">Sorting this report…</p>
        <p className="text-muted-foreground">
          We're working out what kind of problem this is. This page updates by
          itself.
        </p>
      </>
    );
  }
  if (routing.state === "DISMISSED") {
    return (
      <>
        <p className="font-medium">Dismissed</p>
        <p className="text-muted-foreground">
          No contractor was emailed about this report.
        </p>
      </>
    );
  }
  if (routing.state === "WORK_ORDER") {
    return (
      <>
        <p className="font-medium">
          {routing.workOrder?.dispatch
            ? "Sent to a contractor"
            : "Work order created"}
        </p>
        <WorkOrderDetails estateId={estateId} routing={routing} />
      </>
    );
  }
  const suggested = suggestedType(routing);
  return (
    <>
      <p className="font-medium">
        {canManage ? "Waiting for you to decide" : "Waiting for a manager"}
      </p>
      {routing.reason ? (
        <Reason
          canManage={canManage}
          estateId={estateId}
          reason={routing.reason}
        />
      ) : null}
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <SendToContractorDialog
            estateId={estateId}
            key={suggested ?? "none"}
            reportId={reportId}
            suggested={suggested}
          />
          <DismissReportDialog estateId={estateId} reportId={reportId} />
        </div>
      ) : null}
    </>
  );
}

/** What has to happen with this report next, from its routing state. */
export function NextStepCard({
  estateId,
  reportId,
  routing,
}: {
  estateId: string;
  reportId: string;
  routing: ReportRouting;
}) {
  return (
    <SectionCard contentClassName="grid gap-3" title="Next step">
      <Body estateId={estateId} reportId={reportId} routing={routing} />
    </SectionCard>
  );
}
