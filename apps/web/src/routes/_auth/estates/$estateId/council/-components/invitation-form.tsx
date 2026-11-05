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
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Send, UserPlus } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import {
  useCouncilInvitation,
  useEstateInvitationRoles,
} from "@/lib/council-invitations";
import { useEstateRoleAccess } from "@/lib/estate-roles";
import {
  type RoleOption,
  RolePicker,
  roleSelection,
  roleValue,
} from "@/routes/_auth/estates/$estateId/council/-components/role-picker";

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
}: {
  estateId: string;
  options: RoleOption[];
  value: string;
  disabled: boolean;
  onChange: (option: RoleOption) => void;
}) {
  const navigate = useNavigate();
  const { estate } = useEstateRoleAccess(estateId);
  // Leaves the council page; the new-role page returns with ?inviteRole=<id>.
  const create = useCallback(() => {
    navigate({
      to: "/estates/$estateId/roles/new",
      params: { estateId },
      search: { returnTo: "council" },
    });
  }, [navigate, estateId]);
  return (
    <RolePicker
      disabled={disabled}
      label="Invitation role"
      onChange={onChange}
      onCreateRole={canCreateRoles(estate) ? create : undefined}
      options={options}
      value={value}
    />
  );
}

export function CouncilInvitationForm({
  estateId,
  initialRole,
}: {
  estateId: string;
  initialRole?: string;
}) {
  const invitation = useCouncilInvitation(estateId);
  const choices = useEstateInvitationRoles(estateId);
  const [email, setEmail] = useState("");
  const [selection, setSelection] = useState<string | undefined>(initialRole);
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
        <LoadingState label="Loading invitation roles…" rows={2} />
      ) : null}
      {choices.error ? (
        <ErrorState
          message={choices.error.message}
          onRetry={retry}
          retryLabel="Retry invitation roles"
        />
      ) : null}
      {choices.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">No eligible roles</p>
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
            <Send aria-hidden="true" />
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
  // Back from the new-role page: reopen with the created role selected.
  const search: { inviteRole?: unknown } = useSearch({ strict: false });
  const inviteRole =
    typeof search.inviteRole === "string" ? search.inviteRole : undefined;
  return (
    <Dialog defaultOpen={Boolean(inviteRole)}>
      <DialogTrigger render={<Button />}>
        <UserPlus aria-hidden="true" /> Invite member
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            New users get an email · existing users accept on Invitations
          </DialogDescription>
        </DialogHeader>
        <CouncilInvitationForm estateId={estateId} initialRole={inviteRole} />
      </DialogContent>
    </Dialog>
  );
}
