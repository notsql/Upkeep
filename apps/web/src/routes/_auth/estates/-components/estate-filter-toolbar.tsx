import { Field } from "@proj/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@proj/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Search } from "lucide-react";
import type { ChangeEvent } from "react";
import { FilterBar } from "@/components/filter-bar";
import type { EstateStatus } from "@/lib/estates";
import type {
  EstateAccess,
  EstateDirectoryFilters,
} from "@/routes/_auth/estates/-components/estate-directory-filters";

const statusItems: { value: EstateStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ALL", label: "All" },
];

const accessItems: { value: EstateAccess; label: string }[] = [
  { value: "ALL", label: "All access" },
  { value: "OWNED", label: "Owner" },
  { value: "SHARED", label: "Shared with you" },
];

export function EstateFilterToolbar({
  access,
  changeAccess,
  changeSearch,
  changeStatus,
  activeCount,
  clearFilters,
  count,
  filters,
  showCount,
  status,
  id,
  open,
}: {
  id: string;
  open: boolean;
  activeCount: number;
  access: EstateAccess;
  changeAccess: (value: EstateAccess | null) => void;
  changeSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  changeStatus: (value: EstateStatus | null) => void;
  clearFilters: () => void;
  count: number;
  filters: EstateDirectoryFilters;
  showCount: boolean;
  status: EstateStatus;
}) {
  return (
    <div className="has-[search]:mb-6">
      <FilterBar
        actions={
          showCount ? (
            <p className="text-muted-foreground text-sm tabular-nums">
              {count} {count === 1 ? "estate" : "estates"}
            </p>
          ) : null
        }
        activeCount={activeCount}
        id={id}
        label="Filter estates"
        onClear={clearFilters}
        open={open}
        search={
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search estates"
              onChange={changeSearch}
              placeholder="Search by name, MCST number or address"
              type="search"
              value={filters.q ?? ""}
            />
          </InputGroup>
        }
      >
        <Field className="w-full sm:w-48">
          <Select
            items={statusItems}
            onValueChange={changeStatus}
            value={status}
          >
            <SelectTrigger aria-label="Status" className="w-full">
              <SelectValue className="min-w-0 truncate" />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-full sm:w-48">
          <Select
            items={accessItems}
            onValueChange={changeAccess}
            value={access}
          >
            <SelectTrigger aria-label="Access" className="w-full">
              <SelectValue className="min-w-0 truncate" />
            </SelectTrigger>
            <SelectContent>
              {accessItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
    </div>
  );
}
