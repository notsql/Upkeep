import { Field, FieldError, FieldLabel } from "@proj/ui/components/field";
import { Textarea } from "@proj/ui/components/textarea";
import { type ChangeEvent, useCallback, useId, useState } from "react";
import { FormDialog } from "@/components/dialogs/form-dialog";

const MAX_REASON = 500;

/** Asks why an anomaly alert is being dismissed (ID-107); a reason is required. */
export function DismissAlertDialog({
  pending,
  error,
  onDismiss,
  onClose,
}: {
  pending: boolean;
  error?: string;
  onDismiss: (reason: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);

  const change = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setReason(event.target.value);
  }, []);

  const submit = useCallback(() => {
    const trimmed = reason.trim();
    setInvalid(trimmed.length === 0);
    if (trimmed.length > 0) {
      onDismiss(trimmed);
    }
  }, [onDismiss, reason]);

  return (
    <FormDialog
      description="Say why this alert needs no action. Other managers will see your reason."
      error={error}
      onClose={onClose}
      onSubmit={submit}
      open
      pending={pending}
      pendingLabel="Dismissing…"
      submitLabel="Dismiss alert"
      title="Dismiss alert"
    >
      <Field>
        <FieldLabel htmlFor={`${id}-reason`}>Reason</FieldLabel>
        <Textarea
          disabled={pending}
          id={`${id}-reason`}
          maxLength={MAX_REASON}
          onChange={change}
          value={reason}
          {...(invalid
            ? { "aria-describedby": `${id}-error`, "aria-invalid": true }
            : {})}
        />
        {invalid ? (
          <FieldError id={`${id}-error`}>
            Enter a reason for dismissing this alert.
          </FieldError>
        ) : null}
      </Field>
    </FormDialog>
  );
}
