import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Label } from "@proj/ui/components/label";
import { Textarea } from "@proj/ui/components/textarea";
import { type SubmitEvent, useCallback, useState } from "react";
import { DatePicker } from "@/components/forms/date-picker";
import {
  type Asset,
  retirementDateError,
  retirementToday,
  useCorrectAssetRetirement,
} from "@/lib/assets";

export function RetirementEdit({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const correction = useCorrectAssetRetirement(asset.estateId, asset.id);
  const [date, setDate] = useState(asset.retiredOn ?? "");
  const [reason, setReason] = useState(asset.retirementReason ?? "");
  const today = retirementToday();
  const dateError = retirementDateError(date, asset.installedOn);
  const invalid =
    Boolean(dateError) || !reason.trim() || reason.trim().length > 2000;
  const submit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (invalid || correction.isPending) {
        return;
      }
      try {
        await correction.mutateAsync({
          retiredOn: date,
          retirementReason: reason.trim(),
          expectedVersion: asset.lifecycleVersion,
        });
        onClose();
      } catch {
        /* Mutation error stays in the dialog. */
      }
    },
    [invalid, correction, asset, date, reason, onClose]
  );
  const changeReason = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setReason(event.target.value),
    []
  );
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!(open || correction.isPending)) {
        onClose();
      }
    },
    [onClose, correction]
  );
  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit retirement information</DialogTitle>
          <DialogDescription>
            Previous information remains in the lifecycle history.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <Label htmlFor="correction-date">Retirement date</Label>
          <DatePicker
            aria-describedby={
              dateError ? "correction-date-error" : "correction-date-help"
            }
            aria-invalid={Boolean(dateError)}
            clearable={false}
            disabled={correction.isPending}
            id="correction-date"
            max={today}
            min={asset.installedOn ?? undefined}
            onChange={setDate}
            value={date}
          />
          <p
            className="text-muted-foreground text-sm"
            id="correction-date-help"
          >
            Today in Singapore: {today}.
            {asset.installedOn
              ? ` Installation date: ${asset.installedOn}.`
              : ""}
          </p>
          {dateError ? (
            <p
              className="text-destructive text-sm"
              id="correction-date-error"
              role="alert"
            >
              {dateError}
            </p>
          ) : null}
          <Label htmlFor="correction-reason">Retirement reason</Label>
          <Textarea
            disabled={correction.isPending}
            id="correction-reason"
            maxLength={2000}
            onChange={changeReason}
            required
            value={reason}
          />
          {correction.error ? (
            <p role="alert">{correction.error.message}</p>
          ) : null}
          <Button disabled={invalid || correction.isPending} type="submit">
            Save retirement information
          </Button>
          <Button
            disabled={correction.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
