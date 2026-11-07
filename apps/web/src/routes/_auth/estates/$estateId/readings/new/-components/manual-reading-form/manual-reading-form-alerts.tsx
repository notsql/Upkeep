import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";

export function ManualReadingFormAlerts({
  outside,
  saveError,
}: {
  outside: boolean;
  saveError: string | undefined;
}) {
  return (
    <>
      {outside ? (
        <Alert>
          <AlertTitle>Check this measurement</AlertTitle>
          <AlertDescription>
            Outside the expected range. You can still save this measurement; it
            will be flagged for review.
          </AlertDescription>
        </Alert>
      ) : null}
      {saveError ? (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
