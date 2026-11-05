import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import {
  useCouncilInvitation,
  useEstateInvitationRoles,
} from "@/lib/council-invitations";
import {
  type EstateRoleDefinition,
  useEstateRoleAccess,
} from "@/lib/estate-roles";
import {
  type RoleOption,
  RolePicker,
  roleSelection,
  roleValue,
} from "@/routes/_auth/estates/$estateId/council/-components/role-picker";
import { CreateRoleDialog } from "@/routes/_auth/estates/$estateId/roles/-components/create-role-dialog";

function getSelectedRole(
  options: RoleOption[],
  selection: string | undefined
): RoleOption | undefined {
  if (selection !== undefined) {
    return options.find((option) => roleValue(option) === selection);
  }
  return options.find((option) => option.role === "COUNCIL") ?? options[0];
}

function canCreateRoles(
  estate: ReturnType<typeof useEstateRoleAccess>["estate"]
): boolean {
  return Boolean(estate?.canViewEstateRoles && estate.canCreateRoles);
}

/** The invitation role picker, plus "Create new role…" for role creators. */
function InvitationRolePicker({
  estateId,
  options,
  value,
  disabled,
  onChange,
  onCreated,
}: {
  estateId: string;
  options: RoleOption[];
  value: string;
  disabled: boolean;
  onChange: (option: RoleOption) => void;
  onCreated: (customRoleId: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const { estate } = useEstateRoleAccess(estateId);
  const canCreate = canCreateRoles(estate);
  const open = useCallback(() => setCreating(true), []);
  const created = useCallback(
    (role: EstateRoleDefinition) => onCreated(role.id),
    [onCreated]
  );
  return (
    <>
      <RolePicker
        disabled={disabled}
        label="Invitation role"
        onChange={onChange}
        onCreateRole={canCreate ? open : undefined}
        options={options}
        value={value}
      />
      {canCreate ? (
        <CreateRoleDialog
          estateId={estateId}
          onCreated={created}
          onOpenChange={setCreating}
          open={creating}
        />
      ) : null}
    </>
  );
}

export function CouncilInvitationForm({ estateId }: { estateId: string }) {
  const invitation = useCouncilInvitation(estateId);
  const choices = useEstateInvitationRoles(estateId);
  const [email, setEmail] = useState("");
  const [selection, setSelection] = useState<string>();
  const selected = getSelectedRole(choices.data ?? [], selection);
  const retry = useCallback(() => {
    choices.refetch();
  }, [choices]);
  const changeEmail = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value),
    []
  );
  const changeRole = useCallback(
    (option: RoleOption) => setSelection(roleValue(option)),
    []
  );
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (invitation.isPending || !selected) {
        return;
      }
      invitation.mutate(
        { email: email.trim(), ...roleSelection(selected) },
        { onSuccess: () => setEmail("") }
      );
    },
    [invitation, selected, email]
  );
  return (
    <div className="grid gap-3">
      {choices.isPending ? (
        <p role="status">Loading invitation roles…</p>
      ) : null}
      {choices.error ? (
        <div>
          <p role="alert">{choices.error.message}</p>
          <Button onClick={retry} variant="outline">
            Retry invitation roles
          </Button>
        </div>
      ) : null}
      {choices.data?.length === 0 ? (
        <p>No eligible custom roles are available.</p>
      ) : null}
      {choices.data && !choices.isError ? (
        <form className="grid gap-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="council-email">Email</Label>
            <Input
              disabled={invitation.isPending}
              id="council-email"
              maxLength={254}
              onChange={changeEmail}
              required
              type="email"
              value={email}
            />
          </div>
          <InvitationRolePicker
            disabled={
              invitation.isPending || !choices.data?.length || choices.isError
            }
            estateId={estateId}
            onChange={changeRole}
            onCreated={setSelection}
            options={choices.data ?? []}
            value={selected ? roleValue(selected) : ""}
          />
          <Button
            className="justify-self-end"
            disabled={
              invitation.isPending ||
              !email.trim() ||
              !selected ||
              choices.isError
            }
            type="submit"
          >
            {invitation.isPending ? "Sending invitation…" : "Send invitation"}
          </Button>
          {invitation.error ? (
            <p className="text-destructive text-sm" role="alert">
              {invitation.error.message}
            </p>
          ) : null}
          {invitation.data ? (
            <p className="text-sm" role="status">
              {invitation.data.status === "IN_APP"
                ? `Invitation created for ${invitation.data.email}. They can accept it on Invitations. No email was sent.`
                : `Invitation sent to ${invitation.data.email}. Access starts after they accept it.`}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function InviteMemberDialog({ estateId }: { estateId: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Invite member</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            New users receive an email invitation. Existing users accept on
            Invitations. Existing accounts keep their current access.
          </DialogDescription>
        </DialogHeader>
        <CouncilInvitationForm estateId={estateId} />
      </DialogContent>
    </Dialog>
  );
}
