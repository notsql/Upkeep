import { Button } from "@proj/ui/components/button";
import { Spinner } from "@proj/ui/components/spinner";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

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
  return (
    <>
      {message ? (
        <p className="text-destructive text-sm" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {cancel ?? null}
        <Button disabled={disabled} type="submit">
          {pending ? (
            <>
              <Spinner /> Saving role…
            </>
          ) : (
            <>
              <Check aria-hidden="true" /> {action}
            </>
          )}
        </Button>
      </div>
    </>
  );
}
