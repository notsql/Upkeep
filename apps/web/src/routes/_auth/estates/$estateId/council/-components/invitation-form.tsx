import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import {
  useCouncilInvitation,
  useEstateInvitationRoles,
} from "@/lib/council-invitations";
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
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Invite an estate member</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-muted-foreground text-sm">
          New users receive an email invitation. Existing users accept on
          Invitations. Existing accounts keep their current access.
        </p>
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
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            onSubmit={submit}
          >
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
            <RolePicker
              disabled={
                invitation.isPending || !choices.data?.length || choices.isError
              }
              label="Invitation role"
              onChange={changeRole}
              options={choices.data ?? []}
              value={selected ? roleValue(selected) : ""}
            />
            <Button
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
              <p className="text-destructive sm:col-span-2" role="alert">
                {invitation.error.message}
              </p>
            ) : null}
            {invitation.data ? (
              <p className="sm:col-span-2" role="status">
                {invitation.data.status === "IN_APP"
                  ? `Invitation created for ${invitation.data.email}. They can accept it on Invitations. No email was sent.`
                  : `Invitation sent to ${invitation.data.email}. Access starts after they accept it.`}
              </p>
            ) : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
