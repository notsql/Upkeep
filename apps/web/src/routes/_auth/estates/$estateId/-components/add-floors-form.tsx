import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import {
  floorName,
  floorRange,
  type Location,
  MAX_FLOORS,
  parseFloor,
} from "@/lib/locations";

/** Floor names the server created and skipped. */
export interface AddFloorsResult {
  created: string[];
  skipped: string[];
}

interface PreviewFloor {
  exists: boolean;
  floor: number;
  name: string;
}

type Range =
  | { ok: true; floors: PreviewFloor[] }
  | { ok: false; message: string };

function checkRange(
  lowestText: string,
  highestText: string,
  existingLevels: Location[]
): Range {
  const lowest = parseFloor(lowestText);
  const highest = parseFloor(highestText);
  if (lowest === undefined || highest === undefined) {
    return {
      ok: false,
      message: "Enter floors like B2 or L25. There is no floor 0.",
    };
  }
  if (lowest > highest) {
    return {
      ok: false,
      message: "The lowest floor must not be above the highest floor.",
    };
  }
  const floors = floorRange(lowest, highest);
  if (!floors) {
    return {
      ok: false,
      message: `Add at most ${MAX_FLOORS} floors at a time.`,
    };
  }
  // The same rule the server applies: a taken position or name is skipped.
  const positions = new Set(existingLevels.map((level) => level.sortOrder));
  const names = new Set(
    existingLevels.map((level) => level.name.toLowerCase())
  );
  return {
    ok: true,
    floors: floors.map((floor) => {
      const name = floorName(floor);
      return {
        floor,
        name,
        exists: positions.has(floor) || names.has(name.toLowerCase()),
      };
    }),
  };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

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
  const [lowest, setLowest] = useState("");
  const [highest, setHighest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AddFloorsResult>();
  const range = useMemo(
    () => checkRange(lowest, highest, existingLevels),
    [lowest, highest, existingLevels]
  );
  const bothEntered = lowest.trim() !== "" && highest.trim() !== "";

  const changeLowest = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setLowest(event.target.value),
    []
  );
  const changeHighest = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setHighest(event.target.value),
    []
  );

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitted(true);
      if (pending || !range.ok) {
        return;
      }
      const floors = range.floors.map((floor) => floor.floor);
      setPending(true);
      onPendingChange?.(true);
      setError(undefined);
      try {
        setResult(await onSave(Math.min(...floors), Math.max(...floors)));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to add the floors. Please try again."
        );
      } finally {
        setPending(false);
        onPendingChange?.(false);
      }
    },
    [onSave, pending, range, onPendingChange]
  );

  if (result) {
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
          <Button onClick={onDone} type="button">
            Done
          </Button>
        </div>
      </div>
    );
  }

  const newCount = range.ok
    ? range.floors.filter((floor) => !floor.exists).length
    : 0;
  return (
    <form aria-label={title} className="grid gap-3" onSubmit={handleSubmit}>
      <fieldset className="grid gap-3" disabled={pending}>
        <legend className="sr-only">{title}</legend>
        <p className="text-muted-foreground text-sm" id={`${id}-help`}>
          Use L1, L2, … above ground and B1, B2, … for basements. There is no
          floor 0. Up to {MAX_FLOORS} floors at a time.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label htmlFor={`${id}-lowest`}>Lowest floor</Label>
            <Input
              aria-describedby={`${id}-help`}
              autoComplete="off"
              id={`${id}-lowest`}
              onChange={changeLowest}
              placeholder="B2"
              value={lowest}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${id}-highest`}>Highest floor</Label>
            <Input
              aria-describedby={`${id}-help`}
              autoComplete="off"
              id={`${id}-highest`}
              onChange={changeHighest}
              placeholder="L25"
              value={highest}
            />
          </div>
        </div>
        {!range.ok && (submitted || bothEntered) ? (
          <p className="text-destructive text-sm">{range.message}</p>
        ) : null}
        {range.ok ? (
          <div className="grid gap-1">
            <p className="text-sm">
              {plural(range.floors.length, "floor")}: {newCount} new,{" "}
              {range.floors.length - newCount} already exist
              {range.floors.length - newCount === 1 ? "s" : ""}.
            </p>
            <ul
              aria-label="Floors to add"
              className="max-h-48 overflow-y-auto rounded-md border p-2 text-sm"
            >
              {range.floors.map((floor) => (
                <li
                  className={floor.exists ? "text-muted-foreground" : undefined}
                  key={floor.floor}
                >
                  {floor.exists
                    ? `${floor.name} (already exists, will be skipped)`
                    : floor.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
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
