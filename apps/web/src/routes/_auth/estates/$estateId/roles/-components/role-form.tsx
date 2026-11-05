import type { components } from "@proj/api/schema";
import type { ReactNode } from "react";
import type {
  EstatePermission,
  EstateRoleDefinition,
} from "@/lib/estate-roles";
import { RoleFormDetailsFields } from "./role-form-details-fields";
import { RoleFormFooter } from "./role-form-footer";
import { RoleFormPermissions } from "./role-form-permissions";
import { useRoleForm } from "./use-role-form";

/**
 * Role details + permissions grouped by area. Used by the new-role and
 * edit-role pages; `cancel` is the page's outline back/cancel link.
 */
export function RoleForm({
  catalogue,
  initial,
  pending,
  error,
  onSave,
  cancel,
}: {
  catalogue: EstatePermission[];
  initial?: EstateRoleDefinition;
  pending: boolean;
  error: Error | null;
  onSave: (body: components["schemas"]["CreateEstateRoleRequest"]) => void;
  cancel?: ReactNode;
}) {
  const form = useRoleForm(catalogue, initial, pending, error, onSave);
  return (
    <form
      aria-label={initial ? `Edit ${initial.name}` : "New role"}
      className="grid gap-5"
      onSubmit={form.submit}
    >
      <RoleFormDetailsFields
        description={form.description}
        id={form.id}
        name={form.name}
        onDescriptionChange={form.changeDescription}
        onNameChange={form.changeName}
        pending={pending}
      />
      <RoleFormPermissions
        catalogue={catalogue}
        groups={form.groups}
        id={form.id}
        onToggle={form.toggle}
        pending={pending}
        selected={form.selected}
      />
      <RoleFormFooter
        action={form.action}
        cancel={cancel}
        disabled={pending || !catalogue.length}
        message={form.message}
        pending={pending}
      />
    </form>
  );
}
