import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { Textarea } from "@proj/ui/components/textarea";
import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useState,
} from "react";
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
  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
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
            : "Unable to retire the asset. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [
      pending,
      invalid,
      confirmation,
      reference,
      onConfirm,
      retiredOn,
      reason,
      lifecycleVersion,
    ]
  );
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!(open || pending)) {
        onCancel();
      }
    },
    [pending, onCancel]
  );
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setConfirmation(event.target.value),
    []
  );
  const changeReason = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setReason(event.target.value),
    []
  );
  const changeDate = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setRetiredOn(event.target.value),
    []
  );
  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent className="p-6 sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-semibold text-xl">
            Retire {name}?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            The asset stays on record and remains readable, but it can no longer
            be edited until restored.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
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
          <Label htmlFor="retired-on">Retirement date</Label>
          <Input
            aria-describedby={
              dateError ? "retirement-date-error" : "retirement-date-help"
            }
            aria-invalid={Boolean(dateError)}
            disabled={pending}
            id="retired-on"
            max={today}
            min={installedOn ?? undefined}
            onChange={changeDate}
            required
            type="date"
            value={retiredOn}
          />
          <p
            className="text-muted-foreground text-sm"
            id="retirement-date-help"
          >
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
          <Label htmlFor="retirement-reason">Retirement reason</Label>
          <Textarea
            disabled={pending}
            id="retirement-reason"
            maxLength={2000}
            onChange={changeReason}
            required
            value={reason}
          />
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={pending || invalid || confirmation !== reference}
              type="submit"
              variant="destructive"
            >
              {pending ? "Retiring…" : "Retire asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
