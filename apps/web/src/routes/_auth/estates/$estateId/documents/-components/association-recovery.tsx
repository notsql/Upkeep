import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import type { AssociationDialogState } from "./use-document-work-order-dialog";

export function AssociationRecovery({
  state,
}: {
  state: AssociationDialogState;
}) {
  const {
    mutation,
    blocked,
    refreshing,
    refresh,
    refreshError,
    reviewing,
    review,
  } = state;
  return (
    <>
      {mutation.isError ? (
        <Alert className="rounded-xl" variant="destructive">
          <AlertTitle>Review the document link</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>{mutation.error.message}</p>
            {blocked ? (
              <p>
                Refresh to check whether the link was saved before retrying.
              </p>
            ) : (
              <p>Correct the fields and try saving again.</p>
            )}
            <Button
              disabled={refreshing}
              onClick={refresh}
              type="button"
              variant="outline"
            >
              {refreshing ? "Refreshing…" : "Refresh association"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {refreshError ? <p role="alert">{refreshError}</p> : null}
      {reviewing ? (
        <Alert>
          <AlertDescription className="space-y-3">
            <p>Review the current work-order link above before continuing.</p>
            <Button onClick={review} type="button" variant="outline">
              I reviewed the updated link
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
