import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { useCallback } from "react";
import type {
  EstatePermission,
  EstateRoleDefinition,
} from "@/lib/estate-roles";

export function RoleCard({
  role,
  estate,
  catalogue,
  pending,
  onEdit,
  onDelete,
}: {
  role: EstateRoleDefinition;
  estate: components["schemas"]["EstateAccessResponse"];
  catalogue: EstatePermission[];
  pending: boolean;
  onEdit: (role: EstateRoleDefinition) => void;
  onDelete: (role: EstateRoleDefinition) => void;
}) {
  const edit = useCallback(() => onEdit(role), [onEdit, role]);
  const remove = useCallback(() => onDelete(role), [onDelete, role]);
  return (
    <li>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{role.name}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {role.description ? <p>{role.description}</p> : null}
          <div className="flex flex-wrap gap-2">
            {role.permissions.map((code) => (
              <Badge key={code}>
                {catalogue.find((entry) => entry.code === code)?.label ?? code}
              </Badge>
            ))}
          </div>
          {estate.customRoleId === role.id ? (
            <p>
              You cannot edit your own assigned role. Another authorized editor
              must change it.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {estate.canEditRoles ? (
              <Button
                aria-label={`Edit ${role.name}`}
                disabled={!role.canEdit || pending}
                onClick={edit}
                variant="outline"
              >
                Edit
              </Button>
            ) : null}
            {estate.role === "MANAGER" ? (
              <Button
                aria-label={`Delete ${role.name}`}
                disabled={!(estate.canDeleteRoles && role.canDelete) || pending}
                onClick={remove}
                variant="destructive"
              >
                Delete
              </Button>
            ) : null}
          </div>
          {estate.canDeleteRoles && !role.canDelete ? (
            <p>
              Reassign or remove the members holding this role before deleting
              it.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
