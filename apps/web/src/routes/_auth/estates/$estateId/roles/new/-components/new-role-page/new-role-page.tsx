import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { RoleAccessGate } from "@/routes/_auth/estates/$estateId/roles/-components/role-access-gate";

import { NewRoleWorkspace } from "@/routes/_auth/estates/$estateId/roles/new/-components/new-role-page/new-role-workspace";

export function NewRolePage({
  estateId,
  returnTo,
}: {
  estateId: string;
  returnTo?: "council";
}) {
  return (
    <RoleAccessGate estateId={estateId}>
      {(estate) =>
        estate.canCreateRoles ? (
          <NewRoleWorkspace estateId={estateId} returnTo={returnTo} />
        ) : (
          <Alert role="alert">
            <AlertDescription>Role creation unavailable</AlertDescription>
          </Alert>
        )
      }
    </RoleAccessGate>
  );
}
