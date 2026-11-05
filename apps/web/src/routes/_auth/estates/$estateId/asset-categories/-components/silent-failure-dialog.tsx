import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { useCallback } from "react";
import type { EstateAssetCategory } from "@/lib/asset-categories";

/** Confirms flagging or unflagging a category as failing silently (ID-83). */
export function SilentFailureDialog({
  category,
  error,
  pending,
  onConfirm,
  onCancel,
}: {
  category: EstateAssetCategory;
  error?: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const flagging = !category.failsSilently;
  const confirmLabel = flagging ? "Flag category" : "Stop flagging";
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!(open || pending)) {
        onCancel();
      }
    },
    [onCancel, pending]
  );
  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {flagging
              ? `Flag ${category.label} as failing silently?`
              : `Stop flagging ${category.label}?`}
          </DialogTitle>
          <DialogDescription>
            {flagging
              ? `${category.label} assets will be included in regular spot checks, because they can fail without anyone noticing.`
              : `${category.label} assets will no longer be included in spot checks for silent failures.`}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
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
            disabled={pending}
            onClick={onConfirm}
            type="button"
            variant={flagging ? "default" : "destructive"}
          >
            {pending ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
