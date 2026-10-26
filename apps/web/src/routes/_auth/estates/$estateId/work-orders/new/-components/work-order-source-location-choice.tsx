import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";

export function WorkOrderSourceLocationChoice({
  sourceLocation,
  workLocation,
  incompatibleAsset,
  onUseSource,
  onKeepWork,
}: {
  sourceLocation?: string;
  workLocation: string;
  incompatibleAsset: boolean;
  onUseSource: () => void;
  onKeepWork: () => void;
}) {
  if (!sourceLocation) {
    return null;
  }
  return (
    <Alert className="rounded-xl p-4" role="status">
      <AlertTitle>Confirm the work location</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          The report is now at {sourceLocation}. Your work location is{" "}
          {workLocation}.
        </p>
        {incompatibleAsset ? (
          <p>
            Remove the linked asset before using the updated report location.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={incompatibleAsset}
            onClick={onUseSource}
            type="button"
          >
            Use updated report location
          </Button>
          <Button onClick={onKeepWork} type="button" variant="outline">
            Keep work location
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
