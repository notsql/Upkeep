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
import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useState,
} from "react";

export function DeactivateAssetDialog({
  name,
  reference,
  onConfirm,
  onCancel,
}: {
  name: string;
  reference: string;
  onConfirm: (reference: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending || confirmation !== reference) {
        return;
      }
      setPending(true);
      setError(undefined);
      try {
        await onConfirm(confirmation);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to deactivate the asset. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [pending, confirmation, reference, onConfirm]
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
  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent className="p-6 sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-semibold text-xl">
            Deactivate {name}?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            The asset stays on record and remains readable, but it can no longer
            be edited.
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
              disabled={pending || confirmation !== reference}
              type="submit"
              variant="destructive"
            >
              {pending ? "Deactivating…" : "Deactivate asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
