import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { SearchX } from "lucide-react";
import { ListRows } from "@/components/list/list-row";
import { EmptyState } from "@/components/states/empty-state";
import type {
  EstatePermission,
  EstateRoleDefinition,
} from "@/lib/estate-roles";
import { useMobile } from "@/lib/use-mobile";
import {
  RoleItem,
  RoleRow,
} from "@/routes/_auth/estates/$estateId/roles/-components/estate-roles-page/role-row";

export type EstateAccess = components["schemas"]["EstateAccessResponse"];

export function RoleTable({
  roles,
  catalogue,
  estate,
  onDelete,
  onClear,
}: {
  roles: EstateRoleDefinition[];
  catalogue: EstatePermission[];
  estate: EstateAccess;
  onDelete: (role: EstateRoleDefinition) => void;
  onClear: () => void;
}) {
  const mobile = useMobile();
  if (!roles.length) {
    return (
      <EmptyState
        action={
          <Button onClick={onClear} variant="outline">
            Clear filters
          </Button>
        }
        description="Try another name or description"
        icon={SearchX}
        title="No matching roles"
      />
    );
  }
  if (mobile) {
    return (
      <ListRows label="Custom roles">
        {roles.map((role) => (
          <RoleItem
            catalogue={catalogue}
            estate={estate}
            key={role.id}
            onDelete={onDelete}
            role={role}
          />
        ))}
      </ListRows>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label="Custom roles">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Role</TableHead>
            <TableHead scope="col">Permissions</TableHead>
            <TableHead className="text-right" scope="col">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <RoleRow
              catalogue={catalogue}
              estate={estate}
              key={role.id}
              onDelete={onDelete}
              role={role}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
