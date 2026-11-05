import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";

export function LocationFormPositionField({
  id,
  initialSortOrder,
}: {
  id: string;
  initialSortOrder?: number;
}) {
  return (
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
      <p className="text-muted-foreground text-sm" id={`${id}-position-help`}>
        Orders levels from the bottom up, for example B1 is -1 and the roof is
        one above the top floor. Must be unique in the block.
      </p>
    </div>
  );
}
