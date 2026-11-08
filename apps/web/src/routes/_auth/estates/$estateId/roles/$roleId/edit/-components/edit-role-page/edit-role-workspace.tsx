import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { type ReactNode, useCallback } from "react";
import { FormPageHeader } from "@/components/page/form-page-header";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  useEstateRoleDefinitions,
  useEstateRolePermissions,
} from "@/lib/estate-roles";

import { EditForm } from "@/routes/_auth/estates/$estateId/roles/$roleId/edit/-components/edit-role-page/edit-form";

type EstateAccess = components["schemas"]["EstateAccessResponse"];

export function EditRoleWorkspace({
  estateId,
  roleId,
  estate,
}: {
  estateId: string;
  roleId: string;
  estate: EstateAccess;
}) {
  const catalogue = useEstateRolePermissions(estateId);
  const definitions = useEstateRoleDefinitions(estateId);
  const role = definitions.data?.find((item) => item.id === roleId);
  const refresh = useCallback(() => {
    catalogue.refetch();
    definitions.refetch();
  }, [catalogue, definitions]);
  const error = catalogue.error ?? definitions.error;
  let content: ReactNode;
  if (catalogue.isPending || definitions.isPending) {
    content = <LoadingState label="Loading role…" rows={2} />;
  } else if (error) {
    content = (
      <ErrorState
        message={error.message}
        onRetry={refresh}
        retryLabel="Retry role"
      />
    );
  } else if (!role) {
    content = (
      <Alert role="alert">
        <AlertDescription>Role not found</AlertDescription>
      </Alert>
    );
  } else if (estate.customRoleId === role.id) {
    content = (
      <Alert>
        <AlertDescription>Own role · not editable</AlertDescription>
      </Alert>
    );
  } else if (estate.canEditRoles && role.canEdit) {
    content = (
      <EditForm
        catalogue={catalogue.data ?? []}
        estateId={estateId}
        role={role}
      />
    );
  } else {
    content = (
      <Alert>
        <AlertDescription>Role editing unavailable</AlertDescription>
      </Alert>
    );
  }
  return (
    <>
      <FormPageHeader
        breadcrumbs={[
          {
            label: "Roles",
            params: { estateId },
            to: "/estates/$estateId/roles",
          },
          { label: "Edit role" },
        ]}
        title={role ? `Edit ${role.name}` : "Edit role"}
      />
      <div className="grid gap-6">{content}</div>
    </>
  );
}
