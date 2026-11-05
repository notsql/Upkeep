import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { useCallback } from "react";
import type {
  EstatePermission,
  EstateRoleDefinition,
} from "@/lib/estate-roles";

const SHOWN_PERMISSIONS = 3;

export function RoleRow({
  role,
  estate,
  catalogue,
  onEdit,
  onDelete,
}: {
  role: EstateRoleDefinition;
  estate: components["schemas"]["EstateAccessResponse"];
  catalogue: EstatePermission[];
  onEdit: (role: EstateRoleDefinition) => void;
  onDelete: (role: EstateRoleDefinition) => void;
}) {
  const edit = useCallback(() => onEdit(role), [onEdit, role]);
  const remove = useCallback(() => onDelete(role), [onDelete, role]);
  const labels = role.permissions.map(
    (code) => catalogue.find((entry) => entry.code === code)?.label ?? code
  );
  const hidden = labels.length - SHOWN_PERMISSIONS;
  return (
    <TableRow>
      <TableCell className="align-top whitespace-normal">
        <p className="font-medium">{role.name}</p>
        {role.description ? (
          <p className="text-muted-foreground text-sm">{role.description}</p>
        ) : null}
        {estate.customRoleId === role.id ? (
          <p className="text-muted-foreground mt-1 text-xs">
            You cannot edit your own assigned role. Another authorized editor
            must change it.
          </p>
        ) : null}
        {estate.canDeleteRoles && !role.canDelete ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Reassign or remove the members holding this role before deleting it.
          </p>
        ) : null}
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        <span className="sr-only">
          {labels.length} {labels.length === 1 ? "permission" : "permissions"}:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {labels.slice(0, SHOWN_PERMISSIONS).map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
          {hidden > 0 ? (
            <Badge
              title={labels.slice(SHOWN_PERMISSIONS).join(", ")}
              variant="outline"
            >
              +{hidden} more
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right align-top">
        <div className="flex justify-end gap-2">
          {estate.canEditRoles ? (
            <Button
              aria-label={`Edit ${role.name}`}
              disabled={!role.canEdit}
              onClick={edit}
              size="sm"
              variant="outline"
            >
              Edit
            </Button>
          ) : null}
          {estate.role === "MANAGER" ? (
            <Button
              aria-label={`Delete ${role.name}`}
              disabled={!(estate.canDeleteRoles && role.canDelete)}
              onClick={remove}
              size="sm"
              variant="destructive"
            >
              Delete
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
