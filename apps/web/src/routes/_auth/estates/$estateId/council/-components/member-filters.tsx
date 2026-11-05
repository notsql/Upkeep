import { Field } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { type ChangeEvent, useCallback } from "react";
import { FilterBar } from "@/components/filter-bar";

export interface MemberFilter {
  role: string;
  search: string;
}

export const OWNER_ROLE = "OWNER";
export const ALL = "ALL";

export const emptyFilter: MemberFilter = {
  search: "",
  role: ALL,
};

export function isFiltered(filter: MemberFilter): boolean {
  return filter.search.trim() !== "" || filter.role !== ALL;
}

export function matchesFilter(
  filter: MemberFilter,
  entry: { text: string[]; role: string }
): boolean {
  const query = filter.search.trim().toLowerCase();
  const textMatch =
    !query || entry.text.some((value) => value.toLowerCase().includes(query));
  const roleMatch = filter.role === ALL || filter.role === entry.role;
  return textMatch && roleMatch;
}

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const change = useCallback(
    (selected: string | null) => onChange(selected ?? ALL),
    [onChange]
  );
  return (
    <Field className="w-full sm:w-48">
      <Select items={items} onValueChange={change} value={value}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function MemberFilters({
  filter,
  roles,
  onChange,
}: {
  filter: MemberFilter;
  roles: { value: string; label: string }[];
  onChange: (filter: MemberFilter) => void;
}) {
  const search = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange({ ...filter, search: event.target.value }),
    [filter, onChange]
  );
  const role = useCallback(
    (value: string) => onChange({ ...filter, role: value }),
    [filter, onChange]
  );
  return (
    <FilterBar
      label="Filter members"
      search={
        <Input
          aria-label="Search members"
          onChange={search}
          placeholder="Search name or email"
          type="search"
          value={filter.search}
        />
      }
    >
      <FilterSelect
        items={[{ value: ALL, label: "All roles" }, ...roles]}
        label="Filter by role"
        onChange={role}
        value={filter.role}
      />
    </FilterBar>
  );
}
