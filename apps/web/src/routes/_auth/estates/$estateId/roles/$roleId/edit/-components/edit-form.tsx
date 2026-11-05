import type { components } from "@proj/api/schema";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { RotateCw } from "lucide-react";
import { useCallback, useState } from "react";
import {
  type EstateRoleDefinition,
  useUpdateEstateRoleDefinition,
} from "@/lib/estate-roles";
import { RoleForm } from "@/routes/_auth/estates/$estateId/roles/-components/role-form";

export function EditForm({
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
