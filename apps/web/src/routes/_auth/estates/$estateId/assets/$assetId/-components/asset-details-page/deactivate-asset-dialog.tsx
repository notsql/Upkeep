import type { components } from "@proj/api/schema";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { Textarea } from "@proj/ui/components/textarea";
import { type ChangeEvent, useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { DatePicker } from "@/components/forms/date-picker";
import { retirementDateError, retirementToday } from "@/lib/assets";

export function DeactivateAssetDialog({
  name,
  reference,
  lifecycleVersion,
  installedOn,
  onConfirm,
  onCancel,
}: {
  name: string;
  reference: string;
  lifecycleVersion: number;
  installedOn?: string | null;
  onConfirm: (
    request: components["schemas"]["DeactivateAssetRequest"]
  ) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [retiredOn, setRetiredOn] = useState(retirementToday);
  const [reason, setReason] = useState("");
  const today = retirementToday();
  const dateError = retirementDateError(retiredOn, installedOn);
  const invalid =
    Boolean(dateError) || !reason.trim() || reason.trim().length > 2000;
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const handleConfirm = useCallback(async () => {
    if (pending || invalid || confirmation !== reference) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await onConfirm({
        reference: confirmation,
        retiredOn,
        retirementReason: reason.trim(),
        expectedVersion: lifecycleVersion,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't take the asset out of use. Try again."
      );
    } finally {
      setPending(false);
    }
  }, [
    pending,
    invalid,
    confirmation,
    reference,
    onConfirm,
    retiredOn,
    reason,
    lifecycleVersion,
  ]);
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setConfirmation(event.target.value),
    []
  );
  const changeReason = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setReason(event.target.value),
    []
  );
  return (
    <ConfirmDialog
      confirmDisabled={invalid || confirmation !== reference}
      confirmLabel="Take out of use"
      description="The asset stays on record and remains readable, but it can no longer be edited until restored."
      error={error}
      onCancel={onCancel}
      onConfirm={handleConfirm}
      open
      pending={pending}
      pendingLabel="Retiring…"
      title={`Retire ${name}?`}
    >
      <div className="grid gap-4">
        <p className="text-sm" id="deactivate-asset-reference-help">
          Type <strong>{reference}</strong> to confirm.
        </p>
        <Label htmlFor="deactivate-asset-reference">Asset reference</Label>
        <Input
          aria-describedby="deactivate-asset-reference-help"
          autoComplete="off"
          disabled={pending}
          id="deactivate-asset-reference"
          onChange={handleChange}
          value={confirmation}
        />
        <Label htmlFor="retired-on">Date taken out of use</Label>
        <DatePicker
          aria-describedby={
            dateError ? "retirement-date-error" : "retirement-date-help"
          }
          aria-invalid={Boolean(dateError)}
          clearable={false}
          disabled={pending}
          id="retired-on"
          max={today}
          min={installedOn ?? undefined}
          onChange={setRetiredOn}
          value={retiredOn}
        />
        <p className="text-muted-foreground text-sm" id="retirement-date-help">
          Today in Singapore: {today}.
          {installedOn ? ` Installation date: ${installedOn}.` : ""}
        </p>
        {dateError ? (
          <p
            className="text-destructive text-sm"
            id="retirement-date-error"
            role="alert"
          >
            {dateError}
          </p>
        ) : null}
        <Label htmlFor="retirement-reason">Why it's out of use</Label>
        <Textarea
          disabled={pending}
          id="retirement-reason"
          maxLength={2000}
          onChange={changeReason}
          required
          value={reason}
        />
      </div>
    </ConfirmDialog>
  );
}
