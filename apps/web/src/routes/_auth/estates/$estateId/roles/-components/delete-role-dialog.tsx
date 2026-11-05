import { Trash2 } from "lucide-react";
import { useCallback } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  type EstateRoleDefinition,
  useDeleteEstateRole,
} from "@/lib/estate-roles";

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
  const confirm = useCallback(() => {
    if (role) {
      deletion.mutate(role.id, { onSuccess: close });
    }
  }, [role, deletion, close]);
  return (
    <ConfirmDialog
      cancelLabel="Keep role"
      confirmIcon={Trash2}
      confirmLabel="Delete role"
      description="Permanent · invitations and invitation history deleted · pending links stop working"
      error={deletion.error?.message}
      onCancel={close}
      onConfirm={confirm}
      open={Boolean(role)}
      pending={deletion.isPending}
      pendingLabel="Deleting role…"
      title="Delete role"
    >
      <p className="font-medium">{role?.name}</p>
    </ConfirmDialog>
  );
}
