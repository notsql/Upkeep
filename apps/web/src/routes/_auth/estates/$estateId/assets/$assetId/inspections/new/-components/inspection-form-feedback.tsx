import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { InspectionRequestError } from "@/lib/inspections";
import { InspectionSaveRecovery } from "./inspection-save-recovery";

export function InspectionFormFeedback({
  error,
  estateId,
  assetId,
  observedLocationPath,
  reviewLocationPath,
  onRefreshLocation,
  onConfirmLocation,
}: {
  error?: Error;
  estateId: string;
  assetId: string;
  observedLocationPath: string;
  reviewLocationPath?: string;
  onRefreshLocation: () => Promise<void>;
  onConfirmLocation: () => void;
}) {
  return (
    <>
      {error ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            {error.message}{" "}
            {error instanceof InspectionRequestError
              ? null
              : "Refresh inspection history before submitting again."}
          </AlertDescription>
        </Alert>
      ) : null}
      {error instanceof InspectionRequestError && error.status === 409 ? (
        <Button onClick={onRefreshLocation} type="button" variant="outline">
          Refresh asset location
        </Button>
      ) : null}
      {reviewLocationPath === undefined ? null : (
        <Alert>
          <AlertDescription>
            Recorded location: {observedLocationPath}. Current location:{" "}
            {reviewLocationPath}. Review the change before continuing.
          </AlertDescription>
          <Button onClick={onConfirmLocation} type="button" variant="outline">
            Use updated asset location
          </Button>
        </Alert>
      )}
      {error ? (
        <InspectionSaveRecovery assetId={assetId} estateId={estateId} />
      ) : null}
    </>
  );
}
