import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { useCallback, useState } from "react";
import {
  useTransferOwnership,
  useUpdateEstateRole,
} from "@/lib/council-invitations";
import { useEstateSession } from "@/lib/estates";
import { AccessConfirmation } from "@/routes/_auth/estates/$estateId/council/-components/access-confirmation";
import { RemoveMemberButton } from "@/routes/_auth/estates/$estateId/council/-components/access-controls";
import {
  presetOptions,
  type RoleOption,
  RolePicker,
  roleSelection,
  roleValue,
} from "@/routes/_auth/estates/$estateId/council/-components/role-picker";

export function MemberPermission({
  estateId,
  member,
  canTransfer,
  canReassign,
  options,
}: {
  estateId: string;
  member: components["schemas"]["EstateMemberResponse"];
  canTransfer: boolean;
  canReassign: boolean;
  options: RoleOption[];
}) {
  const { userId } = useEstateSession();
  const update = useUpdateEstateRole(estateId);
  const transfer = useTransferOwnership(estateId);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [proposed, setProposed] = useState<string>();
  const showTransfer = useCallback(() => setConfirmTransfer(true), []);
  const closeTransfer = useCallback(() => setConfirmTransfer(false), []);
  const closeRole = useCallback(() => setProposed(undefined), []);
  const currentValue = member.customRoleId ?? member.role;
  const assignableOptions = canReassign ? options : [];
  const pendingRole = assignableOptions.find(
    (option) => roleValue(option) === proposed
  );
  const change = useCallback(
    (option: RoleOption) => {
      if (!canReassign || roleValue(option) === currentValue) {
        return;
      }
      if (
        option.role === "CUSTOM" ||
        member.role === "CUSTOM" ||
        member.role === "RESIDENT"
      ) {
        setProposed(roleValue(option));
        return;
      }
      update.mutate({ memberId: member.userId, body: roleSelection(option) });
    },
    [canReassign, currentValue, member.userId, member.role, update]
  );
  const confirm = useCallback(
    () => transfer.mutateAsync(member.userId),
    [member.userId, transfer]
  );
  const confirmRole = useCallback(
    () =>
      pendingRole
        ? update.mutateAsync({
            memberId: member.userId,
            body: roleSelection(pendingRole),
          })
        : Promise.reject(
            new Error(
              "The selected role is unavailable. Refresh the role choices."
            )
          ),
    [pendingRole, member.userId, update]
  );
  const self = userId === member.userId;
  const roleName =
    member.customRoleName ??
    presetOptions.find((option) => option.role === member.role)?.label ??
    member.role;
  return (
    <TableRow>
      <TableCell className="min-w-32 whitespace-normal break-words font-medium">
        {member.name}
      </TableCell>
      <TableCell className="min-w-44 max-w-64 whitespace-normal break-all">
        {member.email}
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="space-y-2">
          {member.owner ? <Badge>Owner</Badge> : null}
          <p>{roleName}</p>
        </div>
      </TableCell>
      <TableCell className="min-w-60 whitespace-normal">
        <div className="grid gap-3">
          {self || member.owner ? (
            <p className="text-muted-foreground text-sm">
              {member.owner
                ? "Transfer ownership before changing this member’s access."
                : "Another Manager must change or remove your access."}
            </p>
          ) : (
            <>
              <RolePicker
                disabled={update.isPending || !canReassign}
                label={`Role for ${member.name}`}
                onChange={change}
                options={options}
                value={currentValue}
              />
              <RemoveMemberButton
                email={member.email}
                estateId={estateId}
                memberId={member.userId}
              />
            </>
          )}
          {update.isPending ? <p role="status">Saving role…</p> : null}
          {update.isSuccess ? <p role="status">Role saved.</p> : null}
          {update.error && !pendingRole ? (
            <p role="alert">{update.error.message}</p>
          ) : null}
          {canTransfer &&
          !self &&
          !member.owner &&
          member.role === "MANAGER" ? (
            <Button onClick={showTransfer} variant="outline">
              Transfer ownership to {member.name}
            </Button>
          ) : null}
          {confirmTransfer ? (
            <AccessConfirmation
              confirmLabel="Transfer ownership"
              description="They will become the estate owner. You will remain a Manager, and ownership powers will pass to them."
              email={member.email}
              keepLabel="Keep ownership"
              onClose={closeTransfer}
              onConfirm={confirm}
              title="Transfer estate ownership?"
            />
          ) : null}
          {pendingRole ? (
            <AccessConfirmation
              confirmLabel="Change role"
              description={`Assign ${pendingRole.label}. ${member.role === "RESIDENT" && pendingRole.role !== "CUSTOM" ? "New resident submissions in this estate will stop. Their own past reports remain readable." : "The new role replaces the previous role and its permissions."}`}
              email={member.email}
              keepLabel="Keep role"
              onClose={closeRole}
              onConfirm={confirmRole}
              title="Change estate role?"
            />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
