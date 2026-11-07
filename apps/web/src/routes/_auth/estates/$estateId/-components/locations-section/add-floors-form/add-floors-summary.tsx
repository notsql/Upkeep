import { Button } from "@proj/ui/components/button";
import {
  type AddFloorsResult,
  plural,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-range";

export function AddFloorsSummary({
  result,
  onDone,
}: {
  result: AddFloorsResult;
  onDone: () => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1 text-sm" role="status">
        <p>
          {result.created.length > 0
            ? `Added ${plural(result.created.length, "floor")}: ${result.created.join(", ")}.`
            : "No floors were added."}
        </p>
        {result.skipped.length > 0 ? (
          <p className="text-muted-foreground">
            Skipped {result.skipped.length} that already existed:{" "}
            {result.skipped.join(", ")}.
          </p>
        ) : null}
      </div>
      <div>
        <Button onClick={onDone} type="button" variant="outline">
          Done
        </Button>
      </div>
    </div>
  );
}
