import { Card } from "@proj/ui/components/card";
import { ShieldCheck } from "lucide-react";
import type { FilterToggleProps } from "@/components/filters/filter-toggle";
import { ListPageHeader } from "@/components/page/list-page-header";

export function AdminUsersHeader({
  totalUsers,
  filters,
}: {
  totalUsers: number | undefined;
  filters: FilterToggleProps | undefined;
}) {
  return (
    <ListPageHeader
      actions={
        <Card className="gap-1 px-4" size="sm">
          <p className="text-muted-foreground text-xs">Total users</p>
          <p className="text-2xl font-semibold">{totalUsers ?? "—"}</p>
        </Card>
      }
      description="Member roles and estate access"
      filters={filters}
      icon={ShieldCheck}
      title="User roles"
    />
  );
}
