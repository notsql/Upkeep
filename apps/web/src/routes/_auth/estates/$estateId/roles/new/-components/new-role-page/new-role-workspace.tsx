import type { components } from "@proj/api/schema";
import { buttonVariants } from "@proj/ui/components/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { FormPageHeader } from "@/components/page/form-page-header";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  useCreateEstateRole,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { RoleForm } from "@/routes/_auth/estates/$estateId/roles/-components/role-form/role-form";

export function NewRoleWorkspace({
  estateId,
  returnTo,
}: {
  estateId: string;
  returnTo?: "council";
}) {
  const navigate = useNavigate();
  const catalogue = useEstateRolePermissions(estateId);
  const create = useCreateEstateRole(estateId);
  const back = returnTo ?? "roles";
  const save = useCallback(
    (body: components["schemas"]["CreateEstateRoleRequest"]) =>
      create.mutate(body, {
        onSuccess: (role) => {
          if (returnTo === "council") {
            // The invite dialog reopens with this role selected (invitation-form.tsx).
            navigate({
              to: "/estates/$estateId/council",
              params: { estateId },
              search: { inviteRole: role.id } as never,
            });
            return;
          }
          navigate({ to: "/estates/$estateId/roles", params: { estateId } });
        },
      }),
    [create, navigate, estateId, returnTo]
  );
  const retry = useCallback(() => {
    catalogue.refetch();
  }, [catalogue]);
  return (
    <>
      <FormPageHeader
        breadcrumbs={[
          back === "council"
            ? {
                label: "Members",
                params: { estateId },
                to: "/estates/$estateId/council",
              }
            : {
                label: "Roles",
                params: { estateId },
                to: "/estates/$estateId/roles",
              },
          { label: "Create role" },
        ]}
        title="Create role"
      />
      {catalogue.isPending ? (
        <LoadingState label="Loading permissions…" rows={2} />
      ) : null}
      {catalogue.error ? (
        <ErrorState
          message={catalogue.error.message}
          onRetry={retry}
          retryLabel="Retry permissions"
        />
      ) : null}
      {catalogue.data ? (
        <RoleForm
          cancel={
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ estateId }}
              to={
                back === "council"
                  ? "/estates/$estateId/council"
                  : "/estates/$estateId/roles"
              }
            >
              Cancel
            </Link>
          }
          catalogue={catalogue.data}
          error={create.error}
          onSave={save}
          pending={create.isPending}
        />
      ) : null}
    </>
  );
}
