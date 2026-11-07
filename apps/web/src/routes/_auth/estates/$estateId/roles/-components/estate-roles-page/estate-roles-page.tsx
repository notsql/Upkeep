import { RoleWorkspace } from "@/routes/_auth/estates/$estateId/roles/-components/estate-roles-page/role-workspace";
import { RoleAccessGate } from "@/routes/_auth/estates/$estateId/roles/-components/role-access-gate";

export function EstateRolesPage({ estateId }: { estateId: string }) {
  return (
    <RoleAccessGate estateId={estateId}>
      {(estate) => <RoleWorkspace estate={estate} estateId={estateId} />}
    </RoleAccessGate>
  );
}
