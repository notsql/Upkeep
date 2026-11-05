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
import {
  type AssetSort,
  type AssetSortColumn,
  assetSortOptions,
} from "@/lib/asset-sorting";

export function AssetSortControls({
  sort,
  onChange,
}: {
  sort: AssetSort;
  onChange?: (sort: AssetSort) => void;
}) {
  const id = useId();
  const column = sort.sortBy ?? "REFERENCE";
  const descending = sort.direction === "DESC";
  const change = useCallback(
    (value: AssetSortColumn | null) => {
      if (value) {
        onChange?.({
          sortBy: value,
          direction: value === "CONDITION" ? "DESC" : "ASC",
        });
      }
    },
    [onChange]
  );
  const reverse = useCallback(
    () =>
      onChange?.({ sortBy: column, direction: descending ? "ASC" : "DESC" }),
    [column, descending, onChange]
  );
  const Icon = descending ? ArrowDown : ArrowUp;
  return (
    <div className="flex items-end gap-2">
      <Field className="flex-1">
        <FieldLabel htmlFor={id}>Sort assets by</FieldLabel>
        <Select items={assetSortOptions} onValueChange={change} value={column}>
          <SelectTrigger className="w-full" id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {assetSortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button
        aria-label="Reverse asset sort direction"
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
