import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import type { ChangeEvent } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import type { ReadingImportBatch } from "@/lib/reading-imports";

export function ImportBatchRollback({
  batch,
  open,
  reason,
  error,
  pending,
  onCancel,
  onConfirm,
  onReasonChange,
}: {
  batch: ReadingImportBatch;
  open: boolean;
  reason: string;
  error: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onReasonChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <ConfirmDialog
      confirmLabel="Confirm revert"
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={open}
      pending={pending}
      pendingLabel="Reverting…"
      title="Revert import batch"
    >
      <p>
        {batch.sourceLabel} · {batch.importedRows} reading
        {batch.importedRows === 1 ? "" : "s"} inserted by this batch will be
        removed.
      </p>
      <Field>
        <FieldLabel htmlFor="rollback-reason">Reason</FieldLabel>
        <Input
          aria-invalid={Boolean(error)}
          id="rollback-reason"
          maxLength={2000}
          onChange={onReasonChange}
          value={reason}
        />
      </Field>
    </ConfirmDialog>
  );
}
