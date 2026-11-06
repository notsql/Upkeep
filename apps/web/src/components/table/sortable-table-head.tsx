import { Button } from "@proj/ui/components/button";
import { TableHead } from "@proj/ui/components/table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback } from "react";

export function SortableTableHead<T extends string>({
  label,
  column,
  active,
  descending,
  onSort,
}: {
  label: string;
  column: T;
  active: boolean;
  descending: boolean;
  onSort: (column: T) => void;
}) {
  const sort = useCallback(() => onSort(column), [column, onSort]);
  const ActiveIcon = descending ? ArrowDown : ArrowUp;
  const Icon = active ? ActiveIcon : ArrowUpDown;
  const order = descending ? "descending" : "ascending";
  return (
    <TableHead aria-sort={active ? order : "none"}>
      <Button
        aria-label={`Sort by ${label}`}
        className="h-auto justify-start gap-1 px-0 py-1 text-left"
        onClick={sort}
        type="button"
        variant="ghost"
      >
        {label}
        <Icon aria-hidden="true" className="size-3 shrink-0" />
      </Button>
    </TableHead>
  );
}
