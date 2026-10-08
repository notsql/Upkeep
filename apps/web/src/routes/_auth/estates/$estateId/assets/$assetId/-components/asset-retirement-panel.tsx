import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { Textarea } from "@proj/ui/components/textarea";
import { type SubmitEvent, useCallback, useState } from "react";
import {
  type Asset,
  retirementDateError,
  retirementToday,
  useAssetLifecycleEvents,
  useCorrectAssetRetirement,
  useRestoreAsset,
} from "@/lib/assets";

function RetirementEdit({
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
  const changeDate = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDate(event.target.value),
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
          <Input
            aria-describedby={
              dateError ? "correction-date-error" : "correction-date-help"
            }
            aria-invalid={Boolean(dateError)}
            disabled={correction.isPending}
            id="correction-date"
            max={today}
            min={asset.installedOn ?? undefined}
            onChange={changeDate}
            required
            type="date"
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
function Restoration({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const restore = useRestoreAsset(asset.estateId, asset.id);
  const [reference, setReference] = useState("");
  const submit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (reference !== asset.reference || restore.isPending) {
        return;
      }
      try {
        await restore.mutateAsync({
          reference,
          expectedVersion: asset.lifecycleVersion,
        });
        onClose();
      } catch {
        /* Mutation error stays in the dialog. */
      }
    },
    [restore, asset, reference, onClose]
  );
  const changeReference = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setReference(event.target.value),
    []
  );
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!(open || restore.isPending)) {
        onClose();
      }
    },
    [onClose, restore]
  );
  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Restore {asset.name}?</DialogTitle>
          <DialogDescription>
            The same asset returns to active service with its history intact.
            Type {asset.reference} to confirm.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <Label htmlFor="restore-reference">Asset reference</Label>
          <Input
            disabled={restore.isPending}
            id="restore-reference"
            onChange={changeReference}
            value={reference}
          />
          {restore.error ? <p role="alert">{restore.error.message}</p> : null}
          <Button
            disabled={restore.isPending || reference !== asset.reference}
            type="submit"
          >
            Confirm restoration
          </Button>
          <Button
            disabled={restore.isPending}
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
const actionLabels: Record<string, string> = {
  RETIRED: "Retired",
  CORRECTED: "Retirement corrected",
  RESTORED: "Restored",
};
export function AssetRetirementPanel({ asset }: { asset: Asset }) {
  const history = useAssetLifecycleEvents(asset.estateId, asset.id);
  const [mode, setMode] = useState<"restore" | "edit">();
  const closeDialog = useCallback(() => setMode(undefined), []);
  const retryHistory = useCallback(() => history.refetch(), [history]);
  const openRestoration = useCallback(() => setMode("restore"), []);
  const openCorrection = useCallback(() => setMode("edit"), []);
  return (
    <section
      aria-label="Asset lifecycle"
      className="section-surface mt-6 space-y-3"
    >
      {asset.deactivatedAt ? (
        <>
          <dl>
            <dt>Retirement date</dt>
            <dd>{asset.retiredOn ?? "Not recorded"}</dd>
            <dt>Retirement reason</dt>
            <dd className="whitespace-pre-wrap">
              {asset.retirementReason ?? "Not recorded"}
            </dd>
          </dl>
          <div className="flex flex-wrap gap-4">
            <Button onClick={openCorrection} variant="outline">
              Edit retirement information
            </Button>
            <Button onClick={openRestoration}>Restore asset</Button>
          </div>
        </>
      ) : null}
      <h2 className="font-semibold text-xl">Lifecycle history</h2>
      {history.isPending ? (
        <p role="status">Loading lifecycle history…</p>
      ) : null}
      {history.error ? (
        <div role="alert">
          {history.error.message}
          <Button onClick={retryHistory}>Retry history</Button>
        </div>
      ) : null}
      {history.data?.length === 0 ? <p>No lifecycle events recorded.</p> : null}
      <ol aria-label="Lifecycle events" className="grid gap-3">
        {history.data?.map((event) => (
          <li
            className="grid gap-2 rounded-lg border p-3 text-sm"
            key={event.id}
          >
            <p>
              {actionLabels[event.action ?? ""] ?? event.action} ·{" "}
              {event.occurredAt
                ? new Date(event.occurredAt).toLocaleString("en-SG", {
                    timeZone: "Asia/Singapore",
                  })
                : "Not recorded"}{" "}
              (Singapore)
            </p>
            <p className="break-all text-muted-foreground">
              By {event.actorUserId}
            </p>
            <p>
              Previous retirement: {event.previousRetiredOn ?? "Not recorded"} —{" "}
              {event.previousRetirementReason ?? "Not recorded"}
            </p>
            <p>
              Result:{" "}
              {event.deactivatedAt
                ? `${event.retiredOn ?? "Not recorded"} — ${event.retirementReason ?? "Not recorded"}`
                : "Active"}
            </p>
          </li>
        ))}
      </ol>
      {mode === "edit" ? (
        <RetirementEdit asset={asset} onClose={closeDialog} />
      ) : null}
      {mode === "restore" ? (
        <Restoration asset={asset} onClose={closeDialog} />
      ) : null}
    </section>
  );
}
