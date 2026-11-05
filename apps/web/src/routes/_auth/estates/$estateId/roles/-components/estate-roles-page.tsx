import { RoleAccessGate } from "@/routes/_auth/estates/$estateId/roles/-components/role-access-gate";

import { RoleWorkspace } from "./role-workspace";

export function EstateRolesPage({ estateId }: { estateId: string }) {
  return (
    <RoleAccessGate estateId={estateId}>
      {(estate) => <RoleWorkspace estate={estate} estateId={estateId} />}
    </RoleAccessGate>
  );
}
