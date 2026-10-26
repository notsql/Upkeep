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
  useId,
  useState,
} from "react";

/** Confirms a permanent device deactivation by typing its identifier (ID-45). */
export function DeactivateDeviceDialog({
  identifier,
  onConfirm,
  onCancel,
}: {
  identifier: string;
  onConfirm: (identifier: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const id = useId();
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const matches = confirmation === identifier;

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending || !matches) {
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
            : "Unable to deactivate the device. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [pending, matches, onConfirm, confirmation]
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
            Deactivate {identifier}?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            Its key stops working immediately and it can't be reactivated. Its
            readings stay on the asset.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <p className="text-sm" id={`${id}-help`}>
            Type <strong>{identifier}</strong> to confirm.
          </p>
          <Label htmlFor={`${id}-identifier`}>Device identifier</Label>
          <Input
            aria-describedby={`${id}-help`}
            autoComplete="off"
            disabled={pending}
            id={`${id}-identifier`}
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
              disabled={pending || !matches}
              type="submit"
              variant="destructive"
            >
              {pending ? "Deactivating…" : "Deactivate device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
