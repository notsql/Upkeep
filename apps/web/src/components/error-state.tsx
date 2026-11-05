import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { CircleAlert } from "lucide-react";

/**
 * The one "failed to load" view: a destructive Alert (`role="alert"`) with
 * the message and an outline Retry button. Use it for every query error.
 */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
  retryAriaLabel,
}: {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
  /** Accessible name when the visible label alone is ambiguous. */
  retryAriaLabel?: string;
}) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{message}</p>
        <Button
          aria-label={retryAriaLabel}
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          {retryLabel}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
