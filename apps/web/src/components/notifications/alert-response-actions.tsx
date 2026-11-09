import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import { DismissAlertDialog } from "@/components/notifications/dismiss-alert-dialog";
import {
  type Notification,
  useAcknowledgeAlert,
  useDismissAlert,
} from "@/lib/notifications";

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

/**
 * Acknowledge or dismiss an anomaly alert (ID-107). Nothing once dismissed;
 * only Dismiss once acknowledged. `locked` disables both with its reason.
 */
export function AlertResponseActions({
  alert,
  locked,
}: {
  alert: Notification;
  locked?: string;
}) {
  const acknowledge = useAcknowledgeAlert();
  const dismiss = useDismissAlert();
  const { mutateAsync: acknowledgeAsync } = acknowledge;
  const { mutateAsync: dismissAsync } = dismiss;
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string>();
  const [dismissError, setDismissError] = useState<string>();
  const { id } = alert;

  const acknowledgeAlert = useCallback(async () => {
    setError(undefined);
    try {
      await acknowledgeAsync({ notificationId: id });
    } catch (cause) {
      setError(message(cause, "Couldn't mark the alert as seen. Try again."));
    }
  }, [acknowledgeAsync, id]);

  const openDismiss = useCallback(() => {
    setDismissError(undefined);
    setDismissing(true);
  }, []);
  const closeDismiss = useCallback(() => setDismissing(false), []);

  const dismissAlert = useCallback(
    async (reason: string) => {
      setDismissError(undefined);
      try {
        await dismissAsync({ notificationId: id, reason });
        setDismissing(false);
      } catch (cause) {
        setDismissError(
          message(cause, "Couldn't dismiss the alert. Try again.")
        );
      }
    },
    [dismissAsync, id]
  );

  const response = alert.anomaly?.response;
  if (!response || response === "DISMISSED") {
    return null;
  }
  const disabled = Boolean(locked) || acknowledge.isPending;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {response === "NONE" ? (
          <Button
            disabled={disabled}
            onClick={acknowledgeAlert}
            size="sm"
            type="button"
            variant="outline"
          >
            Mark as seen
          </Button>
        ) : null}
        <Button
          disabled={disabled}
          onClick={openDismiss}
          size="sm"
          type="button"
          variant="outline"
        >
          Dismiss
        </Button>
      </div>
      {locked ? (
        <p className="text-muted-foreground text-sm">{locked}</p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {dismissing ? (
        <DismissAlertDialog
          error={dismissError}
          onClose={closeDismiss}
          onDismiss={dismissAlert}
          pending={dismiss.isPending}
        />
      ) : null}
    </div>
  );
}
