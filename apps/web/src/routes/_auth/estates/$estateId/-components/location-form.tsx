import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { type SubmitEvent, useCallback, useId, useState } from "react";
import { LocationFormParentField } from "@/routes/_auth/estates/$estateId/-components/location-form-parent-field";
import { LocationFormPositionField } from "@/routes/_auth/estates/$estateId/-components/location-form-position-field";

export interface LocationFormValues {
  name: string;
  parentId?: string;
  sortOrder?: number;
}

export interface ParentOption {
  id: string;
  label: string;
}

export function LocationForm({
  title,
  initialName,
  initialParentId,
  initialSortOrder,
  showPosition,
  parentOptions,
  onSave,
  onPendingChange,
  onCancel,
}: {
  title: string;
  initialName?: string;
  initialParentId?: string;
  initialSortOrder?: number;
  /** Levels carry their position in the block. */
  showPosition: boolean;
  /** When set, the location can be moved to any of these parents. */
  parentOptions?: ParentOption[];
  onSave: (values: LocationFormValues) => Promise<unknown>;
  onCancel: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const id = useId();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) {
        return;
      }
      const values = new FormData(event.currentTarget);
      const parentId = values.get("parentId");
      const sortOrder = values.get("sortOrder");
      setPending(true);
      onPendingChange?.(true);
      setError(undefined);
      try {
        await onSave({
          name: String(values.get("name") ?? ""),
          parentId: parentId === null ? initialParentId : String(parentId),
          sortOrder: sortOrder === null ? undefined : Number(sortOrder),
        });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to save the location. Please try again."
        );
      } finally {
        setPending(false);
        onPendingChange?.(false);
      }
    },
    [onSave, pending, initialParentId, onPendingChange]
  );
  return (
    <form aria-label={title} className="grid gap-3" onSubmit={handleSubmit}>
      <fieldset className="grid gap-3" disabled={pending}>
        <legend className="sr-only">{title}</legend>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            defaultValue={initialName}
            id={`${id}-name`}
            maxLength={200}
            name="name"
            required
          />
        </div>
        {showPosition ? (
          <LocationFormPositionField
            id={id}
            initialSortOrder={initialSortOrder}
          />
        ) : null}
        {parentOptions ? (
          <LocationFormParentField
            id={id}
            initialParentId={initialParentId}
            parentOptions={parentOptions}
          />
        ) : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit">{pending ? "Saving…" : "Save"}</Button>
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
