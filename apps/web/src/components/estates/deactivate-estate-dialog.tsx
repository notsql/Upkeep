import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  type ChangeEvent,
  type SubmitEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
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
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
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
  const handleCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      if (!pending) {
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
    <dialog
      aria-describedby="deactivate-warning"
      aria-labelledby="deactivate-title"
      className="m-auto w-full max-w-md border bg-card p-6 text-card-foreground shadow-lg backdrop:bg-black/60"
      onCancel={handleCancel}
      ref={dialog}
    >
      <h2 className="font-semibold text-xl" id="deactivate-title">
        Deactivate {name}?
      </h2>
      <p className="mt-3 text-muted-foreground text-sm" id="deactivate-warning">
        Existing records will be preserved. This estate will no longer accept
        new assets or reports.
      </p>
      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
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
        <div className="flex justify-end gap-3">
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
        </div>
      </form>
    </dialog>
  );
}
