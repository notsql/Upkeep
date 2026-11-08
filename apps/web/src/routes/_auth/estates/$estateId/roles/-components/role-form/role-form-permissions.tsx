import { FieldLegend, FieldSet } from "@proj/ui/components/field";
import type { ReactNode } from "react";
import { FormCard } from "@/components/page/form-page";
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
  children,
}: {
  catalogue: EstatePermission[];
  groups: { area: string; permissions: EstatePermission[] }[];
  id: string;
  onToggle: (code: EstatePermissionCode, checked: boolean) => void;
  pending: boolean;
  selected: EstatePermissionCode[];
  /** The form's footer, closing the last card. */
  children?: ReactNode;
}) {
  return (
    <FormCard
      description="Choose at least one. Some need a prerequisite chosen too."
      title="Permissions"
    >
      <div className="grid gap-5">
        {groups.map((group) => (
          <FieldSet className="min-w-0" disabled={pending} key={group.area}>
            <FieldLegend variant="label">{group.area}</FieldLegend>
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
          </FieldSet>
        ))}
        {children}
      </div>
    </FormCard>
  );
}
