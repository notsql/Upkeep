import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useState,
} from "react";
import { FilterBar } from "@/components/filters/filter-bar";
import type { WorkOrderFilters as Filters } from "@/lib/work-orders";

const options: {
  value: NonNullable<Filters["priority"]> | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "All priorities" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const statusOptions: {
  value: NonNullable<Filters["status"]> | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "CLOSED", label: "Closed" },
];
const categoryOptions: {
  value: NonNullable<Filters["category"]> | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "All categories" },
  { value: "EQUIPMENT_FAULT", label: "Equipment fault" },
  { value: "CLEANLINESS", label: "Cleanliness" },
  { value: "SAFETY", label: "Safety" },
];
export function countWorkOrderFilters(filters: Filters): number {
  return [filters.priority, filters.status, filters.category, filters.q].filter(
    Boolean
  ).length;
}

export function WorkOrderFilters({
  filters,
  onChange,
  id: panelId,
  open,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  /** From `useFilterPanel(...).barProps`; omit to always show the bar. */
  id?: string;
  open?: boolean;
}) {
  const id = useId();
  const [priority, setPriority] = useState<
    NonNullable<Filters["priority"]> | "ALL"
  >(filters.priority ?? "ALL");
  const [status, setStatus] = useState<NonNullable<Filters["status"]> | "ALL">(
    filters.status ?? "ALL"
  );
  const [category, setCategory] = useState<
    NonNullable<Filters["category"]> | "ALL"
  >(filters.category ?? "ALL");
  const [q, setQuery] = useState(filters.q ?? "");
  const changeStatus = useCallback(
    (value: NonNullable<Filters["status"]> | "ALL" | null) => {
      if (value) {
        setStatus(value);
      }
    },
    []
  );
  const changeCategory = useCallback(
    (value: NonNullable<Filters["category"]> | "ALL" | null) => {
      if (value) {
        setCategory(value);
      }
    },
    []
  );
  const changePriority = useCallback(
    (value: NonNullable<Filters["priority"]> | "ALL" | null) => {
      if (value) {
        setPriority(value);
      }
    },
    []
  );
  const changeQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    []
  );
  const apply = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onChange({
        ...(priority === "ALL" ? {} : { priority }),
        ...(status === "ALL" ? {} : { status }),
        ...(category === "ALL" ? {} : { category }),
        ...(q.trim() ? { q: q.trim() } : {}),
      });
    },
    [onChange, priority, q, status, category]
  );
  const clear = useCallback(() => {
    setPriority("ALL");
    setStatus("ALL");
    setCategory("ALL");
    setQuery("");
    onChange({});
  }, [onChange]);
  const activeCount = countWorkOrderFilters(filters);
  return (
    <form onSubmit={apply}>
      <FilterBar
        actions={
          <Button type="submit" variant="outline">
            Apply filters
          </Button>
        }
        activeCount={activeCount}
        id={panelId}
        label="Filter work orders"
        onClear={clear}
        open={open}
        search={
          <Field>
            <FieldLabel htmlFor={`${id}-reference`}>
              Search reference
            </FieldLabel>
            <Input
              id={`${id}-reference`}
              maxLength={200}
              onChange={changeQuery}
              placeholder="e.g. MG-W0001"
              value={q}
            />
          </Field>
        }
      >
        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor={`${id}-status`}>Status</FieldLabel>
          <Select
            items={statusOptions}
            onValueChange={changeStatus}
            value={status}
          >
            <SelectTrigger className="w-full" id={`${id}-status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
          <Select
            items={categoryOptions}
            onValueChange={changeCategory}
            value={category}
          >
            <SelectTrigger className="w-full" id={`${id}-category`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor={`${id}-priority`}>Priority</FieldLabel>
          <Select
            items={options}
            onValueChange={changePriority}
            value={priority}
          >
            <SelectTrigger className="w-full" id={`${id}-priority`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
    </form>
  );
}
