import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { useCallback, useState } from "react";
import {
  type EstatePermission,
  type EstateRoleDefinition,
  useDeleteEstateRole,
  useUpdateEstateRoleDefinition,
} from "@/lib/estate-roles";
import { RoleForm } from "@/routes/_auth/estates/$estateId/roles/-components/role-form";

export function EditRoleDialog({
  estateId,
  role,
  roles,
  catalogue,
  onClose,
}: {
  estateId: string;
  role: EstateRoleDefinition | undefined;
  roles: EstateRoleDefinition[];
  catalogue: EstatePermission[];
  onClose: () => void;
}) {
  const update = useUpdateEstateRoleDefinition(estateId);
  // A conflict reloads the latest saved definition into the open form.
  const [reloaded, setReloaded] = useState<EstateRoleDefinition>();
  const editing = reloaded?.id === role?.id ? reloaded : role;
  const close = useCallback(() => {
    update.reset();
    setReloaded(undefined);
    onClose();
  }, [update, onClose]);
  const toggle = useCallback(
    (open: boolean) => {
      if (!(open || update.isPending)) {
        close();
      }
    },
    [update.isPending, close]
  );
  const save = useCallback(
    (body: components["schemas"]["CreateEstateRoleRequest"]) => {
      if (editing) {
        update.mutate(
          {
            roleId: editing.id,
            body: { ...body, expectedVersion: editing.version },
          },
          { onSuccess: close }
        );
      }
    },
    [editing, update, close]
  );
  const reload = useCallback(() => {
    const current = roles.find((item) => item.id === editing?.id);
    if (current) {
      setReloaded(current);
      update.reset();
    }
  }, [roles, editing?.id, update]);
  return (
    <Dialog onOpenChange={toggle} open={Boolean(editing)}>
      {editing ? (
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {editing.name}</DialogTitle>
            <DialogDescription>
              Permission changes affect current members and pending invitations.
            </DialogDescription>
          </DialogHeader>
          <RoleForm
            catalogue={catalogue}
            error={update.error}
            initial={editing}
            key={`${editing.id}:${editing.version}`}
            onCancel={close}
            onSave={save}
            pending={update.isPending}
          />
          {update.error ? (
            <Button onClick={reload} variant="outline">
              Reload role
            </Button>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function DeleteRoleDialog({
  estateId,
  role,
  onClose,
}: {
  estateId: string;
  role: EstateRoleDefinition | undefined;
  onClose: () => void;
}) {
  const deletion = useDeleteEstateRole(estateId);
  const close = useCallback(() => {
    deletion.reset();
    onClose();
  }, [deletion, onClose]);
  const toggle = useCallback(
    (open: boolean) => {
      if (!(open || deletion.isPending)) {
        close();
      }
    },
    [deletion.isPending, close]
  );
  const confirm = useCallback(() => {
    if (role) {
      deletion.mutate(role.id, { onSuccess: close });
    }
  }, [role, deletion, close]);
  return (
    <Dialog onOpenChange={toggle} open={Boolean(role)}>
      {role ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete custom role?</DialogTitle>
            <DialogDescription>
              All invitations and invitation history for this role will be
              permanently deleted. Pending invitation links will stop working.
            </DialogDescription>
          </DialogHeader>
          <p className="font-medium">{role.name}</p>
          {deletion.error ? (
            <p className="text-destructive text-sm" role="alert">
              {deletion.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={deletion.isPending}
              onClick={close}
              variant="outline"
            >
              Keep role
            </Button>
            <Button
              disabled={deletion.isPending}
              onClick={confirm}
              variant="destructive"
            >
              {deletion.isPending ? "Deleting role…" : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
