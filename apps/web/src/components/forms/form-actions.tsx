import { Button } from "@proj/ui/components/button";
export function FormActions({
  label,
  pending,
  onCancel,
}: {
  label: string;
  pending: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-5">
      <Button disabled={pending} type="submit">
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
