import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { type SubmitEvent, useCallback, useId, useState } from "react";

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
      }
    },
    [onSave, pending, initialParentId]
  );
  return (
    <form
      aria-label={title}
      className="mt-2 grid gap-3 border p-3"
      onSubmit={handleSubmit}
    >
      <fieldset className="grid gap-3" disabled={pending}>
        <legend className="font-medium text-sm">{title}</legend>
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
          <div className="grid gap-1">
            <Label htmlFor={`${id}-position`}>Position</Label>
            <Input
              aria-describedby={`${id}-position-help`}
              defaultValue={initialSortOrder}
              id={`${id}-position`}
              name="sortOrder"
              required
              step={1}
              type="number"
            />
            <p
              className="text-muted-foreground text-sm"
              id={`${id}-position-help`}
            >
              Orders levels from the bottom up, for example B1 is -1 and the
              roof is one above the top floor. Must be unique in the block.
            </p>
          </div>
        ) : null}
        {parentOptions ? (
          <div className="grid gap-1">
            <Label htmlFor={`${id}-parent`}>Inside</Label>
            <Select
              defaultValue={initialParentId}
              items={parentOptions.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              name="parentId"
            >
              <SelectTrigger className="w-full" id={`${id}-parent`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit">{pending ? "Saving…" : "Save"}</Button>
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
