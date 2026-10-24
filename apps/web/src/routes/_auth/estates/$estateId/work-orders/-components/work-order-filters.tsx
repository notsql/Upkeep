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

export function WorkOrderFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const id = useId();
  const [priority, setPriority] = useState<
    NonNullable<Filters["priority"]> | "ALL"
  >(filters.priority ?? "ALL");
  const [q, setQuery] = useState(filters.q ?? "");
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
        ...(q.trim() ? { q: q.trim() } : {}),
      });
    },
    [onChange, priority, q]
  );
  const clear = useCallback(() => {
    setPriority("ALL");
    setQuery("");
    onChange({});
  }, [onChange]);
  return (
    <form
      aria-label="Filter work orders"
      className="flex flex-wrap items-end gap-4"
      onSubmit={apply}
    >
      <Field className="w-full sm:w-48">
        <FieldLabel htmlFor={`${id}-priority`}>Priority</FieldLabel>
        <Select items={options} onValueChange={changePriority} value={priority}>
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
      <Field className="w-full sm:w-72">
        <FieldLabel htmlFor={`${id}-reference`}>Search reference</FieldLabel>
        <Input
          id={`${id}-reference`}
          maxLength={200}
          onChange={changeQuery}
          placeholder="e.g. MG-W0001"
          value={q}
        />
      </Field>
      <Button type="submit">Apply filters</Button>
      <Button onClick={clear} type="button" variant="outline">
        Clear filters
      </Button>
    </form>
  );
}
