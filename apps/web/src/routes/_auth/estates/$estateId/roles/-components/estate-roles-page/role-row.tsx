import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, ShieldCheck } from "lucide-react";
import { useCallback } from "react";
import { ListRow } from "@/components/list/list-row";
import type {
  EstatePermission,
  EstateRoleDefinition,
} from "@/lib/estate-roles";

const SHOWN_PERMISSIONS = 3;

export function RoleRow({
  role,
  estate,
  catalogue,
  onDelete,
}: {
  role: EstateRoleDefinition;
  estate: components["schemas"]["EstateAccessResponse"];
  catalogue: EstatePermission[];
  onDelete: (role: EstateRoleDefinition) => void;
}) {
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
            Own role · read-only
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
          {estate.canEditRoles && role.canEdit ? (
            <Link
              aria-label={`Edit ${role.name}`}
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              params={{ estateId: role.estateId, roleId: role.id }}
              to="/estates/$estateId/roles/$roleId/edit"
            >
              <Pencil aria-hidden="true" /> Edit
            </Link>
          ) : null}
          {estate.role === "MANAGER" ? (
            <Button
              aria-label={`Delete ${role.name}`}
              disabled={!(estate.canDeleteRoles && role.canDelete)}
              onClick={remove}
              size="sm"
              variant="ghost"
            >
              Delete
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function roleNote(
  role: EstateRoleDefinition,
  estate: components["schemas"]["EstateAccessResponse"]
): string | null {
  if (estate.customRoleId === role.id) {
    return "Own role · read-only";
  }
  if (estate.canDeleteRoles && !role.canDelete) {
    return "Reassign or remove the members holding this role before deleting it.";
  }
  return null;
}

/** The phone layout of a role: name, permissions summary and a menu of actions. */
export function RoleItem({
  role,
  estate,
  catalogue,
  onDelete,
}: {
  role: EstateRoleDefinition;
  estate: components["schemas"]["EstateAccessResponse"];
  catalogue: EstatePermission[];
  onDelete: (role: EstateRoleDefinition) => void;
}) {
  const remove = useCallback(() => onDelete(role), [onDelete, role]);
  const labels = role.permissions.map(
    (code) => catalogue.find((entry) => entry.code === code)?.label ?? code
  );
  const canEdit = estate.canEditRoles && role.canEdit;
  const showDelete = estate.role === "MANAGER";
  const deleteDisabled = !(estate.canDeleteRoles && role.canDelete);
  const note = roleNote(role, estate);
  const count = `${labels.length} ${labels.length === 1 ? "permission" : "permissions"}`;
  const summary = labels.length ? `${count} · ${labels.join(", ")}` : count;
  return (
    <ListRow
      icon={ShieldCheck}
      meta={<span title={labels.join(", ")}>{summary}</span>}
      title={role.name}
      trailing={
        canEdit || showDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Actions for ${role.name}`}
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? (
                <DropdownMenuItem
                  aria-label={`Edit ${role.name}`}
                  render={
                    <Link
                      params={{ estateId: role.estateId, roleId: role.id }}
                      to="/estates/$estateId/roles/$roleId/edit"
                    />
                  }
                >
                  Edit
                </DropdownMenuItem>
              ) : null}
              {showDelete ? (
                <DropdownMenuItem
                  aria-label={`Delete ${role.name}`}
                  className="text-destructive"
                  disabled={deleteDisabled}
                  onClick={remove}
                >
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      }
    >
      {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
    </ListRow>
  );
}
