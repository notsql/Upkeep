import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { useCallback } from "react";
import { LoadingState } from "@/components/loading-state";
import {
  type EstateRoleDefinition,
  useCreateEstateRole,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { RoleForm } from "@/routes/_auth/estates/$estateId/roles/-components/role-form";

/**
 * The one create-role flow: used by the Roles page header action and by the
 * role picker's "Create new role…" option (stacked over the invite dialog).
 */
export function CreateRoleDialog({
  estateId,
  open,
  onOpenChange,
  onCreated,
}: {
  estateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (role: EstateRoleDefinition) => void;
}) {
  const catalogue = useEstateRolePermissions(estateId);
  const create = useCreateEstateRole(estateId);
  const toggle = useCallback(
    (next: boolean) => {
      if (create.isPending) {
        return;
      }
      if (next) {
        create.reset();
      }
      onOpenChange(next);
    },
    [create, onOpenChange]
  );
  const close = useCallback(() => toggle(false), [toggle]);
  const save = useCallback(
    (body: components["schemas"]["CreateEstateRoleRequest"]) =>
      create.mutate(body, {
        onSuccess: (role) => {
          onOpenChange(false);
          onCreated?.(role);
        },
      }),
    [create, onCreated, onOpenChange]
  );
  const retry = useCallback(() => {
    catalogue.refetch();
  }, [catalogue]);
  return (
    <Dialog onOpenChange={toggle} open={open}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
          <DialogDescription>
            Name the role and choose exactly which permissions it grants.
          </DialogDescription>
        </DialogHeader>
        {catalogue.isPending ? (
          <LoadingState label="Loading permissions…" rows={2} />
        ) : null}
        {catalogue.error ? (
          <Alert role="alert">
            <AlertDescription>{catalogue.error.message}</AlertDescription>
            <Button onClick={retry}>Retry permissions</Button>
          </Alert>
        ) : null}
        {catalogue.data ? (
          <RoleForm
            catalogue={catalogue.data}
            error={create.error}
            onCancel={close}
            onSave={save}
            pending={create.isPending}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
