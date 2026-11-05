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
import { FilterBar } from "@/components/filters/filter-bar";
import type { EstateReportFilters } from "@/lib/estate-reports";
import type { Location } from "@/lib/locations";

import { LevelPositionFilter } from "@/routes/_auth/estates/$estateId/reports/-components/report-filters/level-position-filter";

interface BlockChoice {
  label: string;
  value: string;
}

export function countReportFilters(filters: EstateReportFilters): number {
  return [
    filters.blockId,
    filters.minLevelPosition,
    filters.maxLevelPosition,
  ].filter((value) => value !== undefined).length;
}

export function ReportFilters({
  filters,
  locations,
  onChange,
  id: panelId,
  open,
}: {
  filters: EstateReportFilters;
  locations: Location[];
  onChange: (filters: EstateReportFilters) => void;
  /** From `useFilterPanel(...).barProps`; omit to always show the bar. */
  id?: string;
  open?: boolean;
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
  const activeCount = countReportFilters(filters);
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
    <form className="space-y-3" noValidate onSubmit={apply}>
      <FilterBar
        actions={
          <Button type="submit" variant="outline">
            Apply filters
          </Button>
        }
        activeCount={activeCount}
        id={panelId}
        label="Filter reports"
        onClear={clear}
        open={open}
      >
        <div className="w-full space-y-2 sm:w-48">
          <Label htmlFor={`${id}-block`}>Block</Label>
          <Combobox
            items={choices}
            onValueChange={selectBlock}
            value={selected}
          >
            <ComboboxInput className="w-full" id={`${id}-block`} />
            <ComboboxContent className="rounded-xl">
              <ComboboxEmpty>No blocks found</ComboboxEmpty>
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
        <fieldset className="w-full space-y-2 sm:w-auto">
          <legend className="text-sm font-medium">
            <b>Level position</b>
          </legend>
          <div className="grid grid-cols-2 gap-4 sm:flex">
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
      </FilterBar>
      {error ? (
        <Alert id={`${id}-error`} role="alert" variant="destructive">
          <AlertDescription>
            Enter whole-number positions with minimum less than or equal to
            maximum.
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
