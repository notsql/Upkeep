import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@proj/ui/components/combobox";
import { Label } from "@proj/ui/components/label";
import { type FormEvent, useCallback, useId, useMemo, useState } from "react";
import type { EstateReportFilters } from "@/lib/estate-reports";
import type { Location } from "@/lib/locations";

interface BlockChoice {
  label: string;
  value: string;
}

export function ReportFilters({
  filters,
  locations,
  onChange,
}: {
  filters: EstateReportFilters;
  locations: Location[];
  onChange: (filters: EstateReportFilters) => void;
}) {
  const id = useId();
  const [minimum, setMinimum] = useState(
    String(filters.minLevelPosition ?? "")
  );
  const [maximum, setMaximum] = useState(
    String(filters.maxLevelPosition ?? "")
  );
  const [error, setError] = useState(false);
  const choices: BlockChoice[] = useMemo(
    () => [
      { value: "all", label: "All blocks" },
      ...locations
        .filter((location) => location.type === "BLOCK")
        .map((block) => ({
          value: block.id,
          label: `${block.name}${block.deactivatedAt ? " (Inactive)" : ""}`,
        })),
    ],
    [locations]
  );
  const selected =
    choices.find((choice) => choice.value === filters.blockId) ?? choices[0];
  const filtered =
    !!filters.blockId ||
    filters.minLevelPosition !== undefined ||
    filters.maxLevelPosition !== undefined;
  const positions = useMemo(
    () => [
      "",
      ...Array.from(
        new Set(
          locations
            .filter(
              (location) =>
                location.type === "LEVEL" &&
                (!filters.blockId || location.parentId === filters.blockId)
            )
            .map((location) => location.sortOrder)
            .filter(
              (position): position is number => typeof position === "number"
            )
        )
      )
        .sort((a, b) => a - b)
        .map(String),
    ],
    [locations, filters.blockId]
  );

  const selectBlock = useCallback(
    (choice: BlockChoice | null) => {
      if (choice) {
        onChange({
          ...filters,
          blockId: choice.value === "all" ? undefined : choice.value,
        });
      }
    },
    [filters, onChange]
  );
  const clear = useCallback(() => onChange({}), [onChange]);

  const apply = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const minLevelPosition = minimum === "" ? undefined : Number(minimum);
      const maxLevelPosition = maximum === "" ? undefined : Number(maximum);
      const valid = [minLevelPosition, maxLevelPosition].every(
        (value) =>
          value === undefined ||
          (Number.isInteger(value) &&
            value >= -2_147_483_648 &&
            value <= 2_147_483_647)
      );
      if (
        !valid ||
        (minLevelPosition !== undefined &&
          maxLevelPosition !== undefined &&
          minLevelPosition > maxLevelPosition)
      ) {
        setError(true);
        return;
      }
      setError(false);
      onChange({
        ...(filters.blockId ? { blockId: filters.blockId } : {}),
        ...(minLevelPosition === undefined ? {} : { minLevelPosition }),
        ...(maxLevelPosition === undefined ? {} : { maxLevelPosition }),
      });
    },
    [minimum, maximum, filters.blockId, onChange]
  );

  return (
    <form className="report-filters space-y-3" noValidate onSubmit={apply}>
      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${id}-block`}>Block</Label>
          <Combobox
            items={choices}
            onValueChange={selectBlock}
            value={selected}
          >
            <ComboboxInput className="w-full" id={`${id}-block`} />
            <ComboboxContent className="rounded-xl">
              <ComboboxEmpty>No blocks found.</ComboboxEmpty>
              <ComboboxList>
                {(choice: BlockChoice) => (
                  <ComboboxItem key={choice.value} value={choice}>
                    {choice.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="font-medium text-sm">
            <b>Level position</b>
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <LevelPositionFilter
              errorId={error ? `${id}-error` : undefined}
              id={`${id}-minimum`}
              label="Minimum position"
              onChange={setMinimum}
              placeholder="No minimum"
              positions={positions}
              value={minimum}
            />
            <LevelPositionFilter
              errorId={error ? `${id}-error` : undefined}
              id={`${id}-maximum`}
              label="Maximum position"
              onChange={setMaximum}
              placeholder="No maximum"
              positions={positions}
              value={maximum}
            />
          </div>
        </fieldset>
      </div>
      {error ? (
        <Alert id={`${id}-error`} role="alert" variant="destructive">
          <AlertDescription>
            Enter whole-number positions with minimum less than or equal to
            maximum.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit">Apply filters</Button>
        {filtered ? (
          <Button onClick={clear} type="button" variant="outline">
            Clear filters
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function LevelPositionFilter({
  errorId,
  id,
  label,
  onChange,
  placeholder,
  positions,
  value,
}: {
  errorId?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  positions: string[];
  value: string;
}) {
  const select = useCallback(
    (position: string | null) => {
      if (position !== null) {
        onChange(position);
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        defaultValue={value}
        inputValue={value}
        items={positions}
        onInputValueChange={onChange}
        onValueChange={select}
      >
        <ComboboxInput
          aria-describedby={errorId}
          aria-invalid={!!errorId}
          className="w-full"
          id={id}
          placeholder={placeholder}
        />
        <ComboboxContent className="rounded-xl">
          <ComboboxEmpty>
            No positions found. Type a whole number.
          </ComboboxEmpty>
          <ComboboxList>
            {(position: string) => (
              <ComboboxItem key={position} value={position}>
                {position || placeholder}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
