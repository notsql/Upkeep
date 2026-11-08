import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import type { ReactNode } from "react";

/** FormActions' layout, with Cancel as the page's link rather than a button. */
export function RoleFormFooter({
  action,
  cancel,
  disabled,
  message,
  pending,
}: {
  action: string;
  cancel?: ReactNode;
  disabled: boolean;
  message: string | undefined;
  pending: boolean;
}) {
  const label = pending ? "Saving role…" : action;
  return (
    <>
      {message ? (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        <Button disabled={disabled} type="submit">
          {label}
        </Button>
        {cancel}
      </div>
    </>
  );
}
