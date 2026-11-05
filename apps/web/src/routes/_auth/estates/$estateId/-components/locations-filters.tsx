import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import type { ChangeEvent } from "react";
import { FilterBar } from "@/components/filter-bar";

export function LocationsFilters({
  id,
  query,
  searching,
  onSearch,
  onClear,
  barProps,
}: {
  id: string;
  query: string;
  searching: boolean;
  onSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  barProps: { id: string; open: boolean };
}) {
  return (
    <FilterBar
      activeCount={searching ? 1 : 0}
      label="Filter locations"
      onClear={onClear}
      search={
        <Field>
          <FieldLabel htmlFor={`${id}-search`}>Search locations</FieldLabel>
          <Input
            id={`${id}-search`}
            onChange={onSearch}
            placeholder="Block, level or common area name"
            type="search"
            value={query}
          />
        </Field>
      }
      {...barProps}
    />
  );
}
