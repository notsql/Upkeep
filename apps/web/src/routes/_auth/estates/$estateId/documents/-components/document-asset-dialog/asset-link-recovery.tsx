import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import type { DocumentAssetDialogState } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/use-document-asset-dialog";

export function AssetLinkRecovery({
  state,
}: {
  state: DocumentAssetDialogState;
}) {
  return (
    <>
      {state.mutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>{state.mutation.error.message}</p>
            {state.blocked ? (
              <>
                <p>Refresh to check the saved association before retrying.</p>
                <Button
                  disabled={state.refreshing}
                  onClick={state.refresh}
                  type="button"
                  variant="outline"
                >
                  Refresh association
                </Button>
              </>
            ) : (
              <p>Correct the selection and save again.</p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {state.refreshError ? <p role="alert">{state.refreshError}</p> : null}
      {state.reviewing ? (
        <Alert>
          <AlertDescription>
            <p>Review the current asset link before continuing.</p>
            <Button onClick={state.review} type="button" variant="outline">
              I reviewed the updated link
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
