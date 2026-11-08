import { Button } from "@proj/ui/components/button";
export function FormActions({
  label,
  pending,
  disabled = false,
  onCancel,
}: {
  label: string;
  pending: boolean;
  /** Blocks the submit (not Cancel) when the form cannot be sent yet. */
  disabled?: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-5">
      <Button disabled={pending || disabled} type="submit">
        {label}
      </Button>
      {onCancel ? (
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
