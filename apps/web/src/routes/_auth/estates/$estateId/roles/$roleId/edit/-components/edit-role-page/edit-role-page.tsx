import { RoleAccessGate } from "@/routes/_auth/estates/$estateId/roles/-components/role-access-gate";

import { EditRoleWorkspace } from "@/routes/_auth/estates/$estateId/roles/$roleId/edit/-components/edit-role-page/edit-role-workspace";

export function EditRolePage({
  estateId,
  roleId,
}: {
  estateId: string;
  roleId: string;
}) {
  return (
    <RoleAccessGate className="max-w-3xl" estateId={estateId}>
      {(estate) => (
        <EditRoleWorkspace
          estate={estate}
          estateId={estateId}
          roleId={roleId}
        />
      )}
    </RoleAccessGate>
  );
}
