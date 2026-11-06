import { Button } from "@proj/ui/components/button";
import { useId } from "react";
import { type Location, MAX_FLOORS } from "@/lib/locations";
import { AddFloorsPreview } from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-preview";
import type { AddFloorsResult } from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-range";
import { AddFloorsRangeFields } from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-range-fields";
import { AddFloorsSummary } from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-summary";
import { useAddFloorsForm } from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/use-add-floors-form";

export type { AddFloorsResult } from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-range";

export function AddFloorsForm({
  title,
  existingLevels,
  onSave,
  onDone,
  onCancel,
  onPendingChange,
}: {
  title: string;
  /** The block's active levels, to preview which floors will be skipped. */
  existingLevels: Location[];
  onSave: (
    lowestFloor: number,
    highestFloor: number
  ) => Promise<AddFloorsResult>;
  onDone: () => void;
  onCancel: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const id = useId();
  const form = useAddFloorsForm(existingLevels, onSave, onPendingChange);
  const { range, pending } = form;

  if (form.result) {
    return <AddFloorsSummary onDone={onDone} result={form.result} />;
  }

  return (
    <form
      aria-label={title}
      className="grid gap-3"
      onSubmit={form.handleSubmit}
    >
      <fieldset className="grid gap-3" disabled={pending}>
        <legend className="sr-only">{title}</legend>
        <p className="text-muted-foreground text-sm" id={`${id}-help`}>
          Use L1, L2, … above ground and B1, B2, … for basements. There is no
          floor 0. Up to {MAX_FLOORS} floors at a time.
        </p>
        <AddFloorsRangeFields
          highest={form.highest}
          id={id}
          lowest={form.lowest}
          onHighestChange={form.changeHighest}
          onLowestChange={form.changeLowest}
        />
        {!range.ok && (form.submitted || form.bothEntered) ? (
          <p className="text-destructive text-sm">{range.message}</p>
        ) : null}
        {range.ok ? <AddFloorsPreview floors={range.floors} /> : null}
        {form.error ? (
          <p className="text-destructive text-sm" role="alert">
            {form.error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit">{pending ? "Adding…" : "Add floors"}</Button>
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
