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

export function DeactivateEstateDialog({
  name,
  code,
  onConfirm,
  onCancel,
}: {
  name: string;
  code: string;
  onConfirm: (code: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending || confirmation !== code) {
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
            : "Unable to deactivate the estate. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [pending, confirmation, code, onConfirm]
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
            Existing records will be preserved. This estate will no longer
            accept new assets or reports.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <p className="text-sm" id="deactivate-code-help">
            Type <strong>{code}</strong> to confirm.
          </p>
          <Label htmlFor="deactivate-code">Estate code</Label>
          <Input
            aria-describedby="deactivate-code-help"
            autoComplete="off"
            disabled={pending}
            id="deactivate-code"
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
              disabled={pending || confirmation !== code}
              type="submit"
              variant="destructive"
            >
              {pending ? "Deactivating…" : "Deactivate estate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
