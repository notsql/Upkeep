import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import type {
  EstatePermission,
  EstatePermissionCode,
} from "@/lib/estate-roles";
import { PermissionChoice } from "@/routes/_auth/estates/$estateId/roles/-components/role-form/permission-choice";

export function RoleFormPermissions({
  catalogue,
  groups,
  id,
  onToggle,
  pending,
  selected,
}: {
  catalogue: EstatePermission[];
  groups: { area: string; permissions: EstatePermission[] }[];
  id: string;
  onToggle: (code: EstatePermissionCode, checked: boolean) => void;
  pending: boolean;
  selected: EstatePermissionCode[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Permissions</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {groups.map((group) => (
          <fieldset
            className="grid min-w-0 gap-2"
            disabled={pending}
            key={group.area}
          >
            <legend className="mb-1 text-sm font-medium">{group.area}</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {group.permissions.map((permission) => (
                <PermissionChoice
                  catalogue={catalogue}
                  checked={selected.includes(permission.code)}
                  id={id}
                  key={permission.code}
                  onChange={onToggle}
                  permission={permission}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </CardContent>
    </Card>
  );
}
