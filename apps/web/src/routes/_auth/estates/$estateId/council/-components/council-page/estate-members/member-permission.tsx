import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { TableCell, TableRow } from "@proj/ui/components/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@proj/ui/components/tooltip";
import { MoreHorizontal } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { ListRow } from "@/components/list/list-row";
import {
  useTransferOwnership,
  useUpdateEstateRole,
} from "@/lib/council-invitations";
import { useEstateSession } from "@/lib/estates";
import { AccessConfirmation } from "@/routes/_auth/estates/$estateId/council/-components/council-page/access-confirmation";
import {
  RemoveMemberButton,
  RemoveMemberConfirmation,
} from "@/routes/_auth/estates/$estateId/council/-components/council-page/estate-members/remove-member-button";
import {
  presetOptions,
  type RoleOption,
  RolePicker,
  roleSelection,
  roleValue,
} from "@/routes/_auth/estates/$estateId/council/-components/council-page/role-picker";

export function MemberPermission({
  estateId,
  member,
  canTransfer,
  canReassign,
  options,
  mobile = false,
}: {
  estateId: string;
  member: components["schemas"]["EstateMemberResponse"];
  canTransfer: boolean;
  canReassign: boolean;
  options: RoleOption[];
  mobile?: boolean;
}) {
  const { userId } = useEstateSession();
  const update = useUpdateEstateRole(estateId);
  const transfer = useTransferOwnership(estateId);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [proposed, setProposed] = useState<string>();
  const showTransfer = useCallback(() => setConfirmTransfer(true), []);
  const closeTransfer = useCallback(() => setConfirmTransfer(false), []);
  const closeRole = useCallback(() => setProposed(undefined), []);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const showRemove = useCallback(() => setConfirmRemove(true), []);
  const closeRemove = useCallback(() => setConfirmRemove(false), []);
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
  const offerTransfer =
    canTransfer && !self && !member.owner && member.role === "MANAGER";
  const lockedNote = member.owner
    ? "Transfer ownership first to change this."
    : "Another Manager can change your role.";
  const locked = self || member.owner;
  const feedback = (
    <RoleFeedback hideError={Boolean(pendingRole)} update={update} />
  );
  const picker = (
    <RolePicker
      disabled={update.isPending || !canReassign}
      label={`Role for ${member.name}`}
      onChange={change}
      options={options}
      value={currentValue}
    />
  );
  const dialogs = (
    <MemberDialogs
      estateId={estateId}
      member={member}
      onCloseRemove={closeRemove}
      onCloseRole={closeRole}
      onCloseTransfer={closeTransfer}
      onConfirmRole={confirmRole}
      onConfirmTransfer={confirm}
      pendingRole={pendingRole}
      removing={confirmRemove}
      transferring={confirmTransfer}
    />
  );
  if (mobile) {
    return (
      <MemberItem
        actions={
          locked ? null : (
            <MemberActionsMenu
              member={member}
              onRemove={showRemove}
              onTransfer={offerTransfer ? showTransfer : undefined}
            />
          )
        }
        member={member}
        roleName={roleName}
      >
        {locked ? (
          <p className="text-muted-foreground text-xs">{lockedNote}</p>
        ) : (
          picker
        )}
        {feedback}
        {dialogs}
      </MemberItem>
    );
  }
  return (
    <TableRow>
      <TableCell className="min-w-32 font-medium break-words whitespace-normal">
        {member.name}
      </TableCell>
      <TableCell className="text-muted-foreground max-w-64 truncate">
        {member.email}
      </TableCell>
      <TableCell>
        <RoleBadge owner={member.owner} roleName={roleName} />
      </TableCell>
      <TableCell className="min-w-60 whitespace-normal">
        <div className="grid gap-3">
          {locked ? (
            <p className="text-muted-foreground text-xs">{lockedNote}</p>
          ) : (
            <>
              {picker}
              <RemoveMemberButton
                email={member.email}
                estateId={estateId}
                memberId={member.userId}
              />
            </>
          )}
          {feedback}
          {offerTransfer ? (
            <Button onClick={showTransfer} variant="outline">
              Transfer ownership to {member.name}
            </Button>
          ) : null}
          {dialogs}
        </div>
      </TableCell>
    </TableRow>
  );
}

function RoleFeedback({
  update,
  hideError,
}: {
  update: ReturnType<typeof useUpdateEstateRole>;
  hideError: boolean;
}) {
  return (
    <>
      {update.isPending ? <p role="status">Saving role…</p> : null}
      {update.isSuccess ? <p role="status">Role saved.</p> : null}
      {update.error && !hideError ? (
        <p role="alert">{update.error.message}</p>
      ) : null}
    </>
  );
}

function roleChangeDescription(
  member: components["schemas"]["EstateMemberResponse"],
  pendingRole: RoleOption
): string {
  const effect =
    member.role === "RESIDENT" && pendingRole.role !== "CUSTOM"
      ? "New resident submissions in this estate will stop. Their own past reports remain readable."
      : "The new role replaces the previous role and its permissions.";
  return `Assign ${pendingRole.label}. ${effect}`;
}

function MemberDialogs({
  estateId,
  member,
  pendingRole,
  transferring,
  removing,
  onCloseTransfer,
  onConfirmTransfer,
  onCloseRole,
  onConfirmRole,
  onCloseRemove,
}: {
  estateId: string;
  member: components["schemas"]["EstateMemberResponse"];
  pendingRole?: RoleOption;
  transferring: boolean;
  removing: boolean;
  onCloseTransfer: () => void;
  onConfirmTransfer: () => Promise<unknown>;
  onCloseRole: () => void;
  onConfirmRole: () => Promise<unknown>;
  onCloseRemove: () => void;
}) {
  return (
    <>
      {transferring ? (
        <AccessConfirmation
          confirmLabel="Transfer ownership"
          description="They will become the estate owner. You will remain a Manager, and ownership powers will pass to them."
          email={member.email}
          keepLabel="Keep ownership"
          onClose={onCloseTransfer}
          onConfirm={onConfirmTransfer}
          title="Transfer estate ownership?"
        />
      ) : null}
      {pendingRole ? (
        <AccessConfirmation
          confirmLabel="Change role"
          description={roleChangeDescription(member, pendingRole)}
          email={member.email}
          keepLabel="Keep role"
          onClose={onCloseRole}
          onConfirm={onConfirmRole}
          title="Change estate role?"
        />
      ) : null}
      {removing ? (
        <RemoveMemberConfirmation
          email={member.email}
          estateId={estateId}
          memberId={member.userId}
          onClose={onCloseRemove}
        />
      ) : null}
    </>
  );
}

function MemberActionsMenu({
  member,
  onRemove,
  onTransfer,
}: {
  member: components["schemas"]["EstateMemberResponse"];
  onRemove: () => void;
  onTransfer?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Actions for ${member.name}`}
            size="icon"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onTransfer ? (
          <DropdownMenuItem onClick={onTransfer}>
            Transfer ownership to {member.name}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          aria-label={`Remove access for ${member.email}`}
          className="text-destructive"
          onClick={onRemove}
        >
          Remove access
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One role badge; the Owner badge explains ownership on hover or focus. */
function RoleBadge({ owner, roleName }: { owner: boolean; roleName: string }) {
  if (!owner) {
    return <Badge variant="secondary">{roleName}</Badge>;
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge tabIndex={0} />}>Owner</TooltipTrigger>
      <TooltipContent>Full Manager access plus ownership</TooltipContent>
    </Tooltip>
  );
}

function MemberItem({
  member,
  roleName,
  actions,
  children,
}: {
  member: components["schemas"]["EstateMemberResponse"];
  roleName: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <ListRow
      initial={member.name.trim().charAt(0).toUpperCase() || "?"}
      meta={member.email}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{member.name}</span>
          <RoleBadge owner={member.owner} roleName={roleName} />
        </span>
      }
      trailing={actions}
    >
      {children}
    </ListRow>
  );
}
