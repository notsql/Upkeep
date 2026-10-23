import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { WorkOrderRequestError } from "@/lib/work-orders";
export function WorkOrderSaveError({
  error,
  estateId,
  reportSource,
  reloadSource,
}: {
  error: Error | undefined;
  estateId: string;
  reportSource: boolean;
  reloadSource: () => Promise<void>;
}) {
  if (!error) {
    return null;
  }
  return (
    <Alert role="alert" variant="destructive">
      <AlertDescription>
        {error.message}{" "}
        {error instanceof WorkOrderRequestError &&
        error.status === 409 &&
        reportSource ? (
          <Button onClick={reloadSource} type="button">
            Reload source
          </Button>
        ) : null}
        <p>
          If the connection was interrupted, check the work-order list before
          submitting again.
        </p>
        <Link params={{ estateId }} to="/estates/$estateId/work-orders">
          Check work orders
        </Link>
      </AlertDescription>
    </Alert>
  );
}
