import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import type { EstateAssetCategory } from "@/lib/asset-categories";
import { useMobile } from "@/lib/use-mobile";
import {
  CategoryItem,
  CategoryRow,
} from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/category-row";

export function CheckSchedulesTable({
  categories,
  disabled,
  onEditInterval,
  onToggleFlag,
}: {
  categories: EstateAssetCategory[];
  disabled: boolean;
  onEditInterval: (category: EstateAssetCategory) => void;
  onToggleFlag: (category: EstateAssetCategory) => void;
}) {
  const mobile = useMobile();
  if (mobile) {
    return (
      <ul aria-label="Equipment types" className="flex min-w-0 flex-col">
        {categories.map((category, index) => (
          <CategoryItem
            category={category}
            disabled={disabled}
            first={index === 0}
            key={category.code}
            onEditInterval={onEditInterval}
            onToggleFlag={onToggleFlag}
          />
        ))}
      </ul>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Equipment type</TableHead>
          <TableHead>Assets</TableHead>
          <TableHead>Regular checks</TableHead>
          <TableHead>How often</TableHead>
          <TableHead>Last changed</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <CategoryRow
            category={category}
            disabled={disabled}
            key={category.code}
            onEditInterval={onEditInterval}
            onToggleFlag={onToggleFlag}
          />
        ))}
      </TableBody>
    </Table>
  );
}
