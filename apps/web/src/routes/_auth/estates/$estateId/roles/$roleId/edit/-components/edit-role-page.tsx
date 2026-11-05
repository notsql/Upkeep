import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { RotateCw } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { FormPageHeader } from "@/components/page-header";
import {
  type EstateRoleDefinition,
  useEstateRoleDefinitions,
  useEstateRolePermissions,
  useUpdateEstateRoleDefinition,
} from "@/lib/estate-roles";
import { RoleAccessGate } from "@/routes/_auth/estates/$estateId/roles/-components/role-access-gate";
import { RoleForm } from "@/routes/_auth/estates/$estateId/roles/-components/role-form";

type EstateAccess = components["schemas"]["EstateAccessResponse"];

function EditForm({
  estateId,
  role,
  catalogue,
}: {
  estateId: string;
  role: EstateRoleDefinition;
  catalogue: components["schemas"]["EstatePermissionResponse"][];
}) {
  const navigate = useNavigate();
  const update = useUpdateEstateRoleDefinition(estateId);
  // The version observed when editing began; Reload adopts the latest one.
  const [base, setBase] = useState(role);
  const save = useCallback(
    (body: components["schemas"]["CreateEstateRoleRequest"]) =>
      update.mutate(
        { roleId: base.id, body: { ...body, expectedVersion: base.version } },
        {
          onSuccess: () =>
            navigate({ to: "/estates/$estateId/roles", params: { estateId } }),
        }
      ),
    [update, base, navigate, estateId]
  );
  const reload = useCallback(() => {
    setBase(role);
    update.reset();
  }, [role, update]);
  return (
    <>
      <RoleForm
        cancel={
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ estateId }}
            to="/estates/$estateId/roles"
          >
            Cancel
          </Link>
        }
        catalogue={catalogue}
        error={update.error}
        initial={base}
        key={`${base.id}:${base.version}`}
        onSave={save}
        pending={update.isPending}
      />
      {update.error ? (
        <Button className="mt-3" onClick={reload} variant="outline">
          <RotateCw aria-hidden="true" /> Reload role
        </Button>
      ) : null}
    </>
  );
}

function EditRoleWorkspace({
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
      {content}
    </>
  );
}

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
