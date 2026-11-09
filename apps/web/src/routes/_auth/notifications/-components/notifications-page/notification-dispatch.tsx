import { DispatchAction } from "@/components/dispatch/dispatch-action";
import { FailedCheckAction } from "@/components/dispatch/failed-check-action";
import { AskSomeoneLine } from "@/components/who-can-help/ask-someone-line";
import type { Notification } from "@/lib/notifications";
import { useWorkOrderAccess } from "@/lib/work-orders";

/**
 * The send step under an open notification: crew for a service or repair
 * warning, a contractor for a failed inspection.
 */
export function NotificationDispatch({
  notification,
}: {
  notification: Notification;
}) {
  const access = useWorkOrderAccess(notification.estateId);
  if (notification.resolvedAt || access.pending) {
    return null;
  }
  const { estateId, assetId, assetName, inspectionResultId } = notification;
  if (notification.type === "CHECK_FAILED" && inspectionResultId) {
    return (
      <div className="px-4 pb-4">
        {access.canCreate ? (
          <FailedCheckAction
            estateId={estateId}
            inspectionResultId={inspectionResultId}
          />
        ) : (
          <AskSomeoneLine
            action="SEND_CONTRACTOR"
            doing="send a contractor"
            estateId={estateId}
          />
        )}
      </div>
    );
  }
  if (
    notification.type === "SERVICE_DUE" ||
    notification.type === "REPAIR_PREDICTED"
  ) {
    return (
      <div className="px-4 pb-4">
        <DispatchAction
          assetId={assetId}
          assetName={assetName}
          canSend={access.canCreate}
          estateId={estateId}
          route="CREW"
        />
      </div>
    );
  }
  return null;
}
