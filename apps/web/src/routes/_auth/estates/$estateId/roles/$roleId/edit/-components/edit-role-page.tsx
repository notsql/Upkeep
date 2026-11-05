import { RoleAccessGate } from "@/routes/_auth/estates/$estateId/roles/-components/role-access-gate";

import { EditRoleWorkspace } from "./edit-role-workspace";

export function EditRolePage({
  estateId,
  roleId,
}: {
  estateId: string;
  roleId: string;
}) {
  return (
    <RoleAccessGate estateId={estateId}>
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
