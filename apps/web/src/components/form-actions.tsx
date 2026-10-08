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
    <div className="page-actions border-t pt-5">
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
