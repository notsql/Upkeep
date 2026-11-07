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
import { type SubmitEvent, useCallback, useState } from "react";
import { type Asset, useRestoreAsset } from "@/lib/assets";

export function Restoration({
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
