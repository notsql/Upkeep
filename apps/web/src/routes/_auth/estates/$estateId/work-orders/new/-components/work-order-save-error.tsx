import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
  isSourcePlacementConflict,
  WorkOrderRequestError,
} from "@/lib/work-orders";
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
  const conflict = reportSource && isSourcePlacementConflict(error);
  const network = !(error instanceof WorkOrderRequestError);
  return (
    <Alert className="rounded-xl p-4" role="alert" variant="destructive">
      <AlertTitle>
        {conflict ? "Source report changed" : "Unable to create work order"}
      </AlertTitle>
      <AlertDescription className="space-y-3 text-sm">
        <p>{error.message}</p>
        {conflict ? (
          <Button onClick={reloadSource} type="button" variant="outline">
            Reload source
          </Button>
        ) : null}
        {network ? (
          <>
            <p>
              If the connection was interrupted, check the work-order list
              before submitting again.
            </p>
            <Link params={{ estateId }} to="/estates/$estateId/work-orders">
              Check work orders
            </Link>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
