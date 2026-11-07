import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useCallback, useId } from "react";
import type { WorkOrderListSearch } from "@/lib/work-orders";

type SortColumn = NonNullable<WorkOrderListSearch["sortBy"]>;
const options: { value: SortColumn; label: string }[] = [
  { value: "REFERENCE", label: "Reference" },
  { value: "CATEGORY", label: "Category" },
  { value: "PRIORITY", label: "Priority" },
  { value: "CREATED_AT", label: "Created" },
];

export function WorkOrderSortControls({
  sortBy,
  descending,
  onSort,
}: {
  sortBy: SortColumn;
  descending: boolean;
  onSort: (column: SortColumn) => void;
}) {
  const id = useId();
  const change = useCallback(
    (column: SortColumn | null) => {
      if (column && column !== sortBy) {
        onSort(column);
      }
    },
    [onSort, sortBy]
  );
  const reverse = useCallback(() => onSort(sortBy), [onSort, sortBy]);
  const Icon = descending ? ArrowDown : ArrowUp;
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <Field className="min-w-32 flex-1">
        <FieldLabel htmlFor={id}>Sort work orders by</FieldLabel>
        <Select items={options} onValueChange={change} value={sortBy}>
          <SelectTrigger className="w-full" id={id}>
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
      <Button
        aria-label="Reverse sort direction"
        onClick={reverse}
        type="button"
        variant="outline"
      >
        <Icon aria-hidden="true" className="size-4" />
        {descending ? "Descending" : "Ascending"}
      </Button>
    </div>
  );
}
