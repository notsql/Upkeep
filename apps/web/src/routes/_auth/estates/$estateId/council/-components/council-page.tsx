import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Checkbox } from "@proj/ui/components/checkbox";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useCallback, useState } from "react";
import {
  useCouncilInvitation,
  useEstateMembers,
  useInvitationPermission,
} from "@/lib/council-invitations";
import { useEstate } from "@/lib/estates";
import {
  OwnerInvitations,
  RemoveMemberButton,
} from "@/routes/_auth/estates/$estateId/council/-components/access-controls";

function MemberPermission({
  estateId,
  userId,
  name,
  email,
  allowed,
}: {
  estateId: string;
  userId: string;
  name: string;
  email: string;
  allowed: boolean;
}) {
  const permission = useInvitationPermission(estateId);
  const change = useCallback(
    (checked: boolean) => {
      permission.mutate({
        memberId: userId,
        body: { canInviteMembers: checked },
      });
    },
    [permission, userId]
  );
  return (
    <li className="space-y-2 border-b py-4 last:border-b-0">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground text-sm">{email}</p>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allowed}
          disabled={permission.isPending}
          id={`invite-${userId}`}
          onCheckedChange={change}
        />
        <Label htmlFor={`invite-${userId}`}>
          Can invite members for {name}
        </Label>
      </div>
      <RemoveMemberButton email={email} estateId={estateId} memberId={userId} />
      {permission.error ? (
        <p className="text-destructive text-sm" role="alert">
          {permission.error.message}
        </p>
      ) : null}
    </li>
  );
}

function CouncilInvitationForm({ estateId }: { estateId: string }) {
  const invitation = useCouncilInvitation(estateId);
  const [email, setEmail] = useState("");
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (invitation.isPending) {
        return;
      }
      invitation.mutate(
        { email: email.trim() },
        {
          onSuccess: () => {
            setEmail("");
          },
        }
      );
    },
    [email, invitation]
  );
  const changeEmail = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setEmail(event.target.value),
    []
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Invite a council member</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-muted-foreground text-sm">
          New users receive an email invitation. Existing users accept on My
          estates. Existing accounts keep their current access.
        </p>
        <form className="space-y-4" onSubmit={submit}>
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
          <Button
            disabled={invitation.isPending || !email.trim()}
            type="submit"
          >
            {invitation.isPending ? "Sending invitation…" : "Send invitation"}
          </Button>
          {invitation.error ? (
            <p className="text-destructive" role="alert">
              {invitation.error.message}
            </p>
          ) : null}
          {invitation.data ? (
            <p role="status">
              {invitation.data.status === "IN_APP"
                ? `Invitation created for ${invitation.data.email}. They can accept it on My estates. No email was sent.`
                : `Invitation sent to ${invitation.data.email}. Access starts after they accept it.`}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function CouncilPage({ estateId }: { estateId: string }) {
  const estate = useEstate(estateId);
  const canManage = estate.data?.canManageInvitationPermissions === true;
  const members = useEstateMembers(estateId, canManage);
  if (estate.isPending) {
    return <p role="status">Loading estate…</p>;
  }
  if (estate.error) {
    return <p role="alert">{estate.error.message}</p>;
  }
  if (!(estate.data.canInviteMembers || canManage)) {
    return (
      <p role="alert">
        You do not have permission to invite members to this estate.
      </p>
    );
  }
  return (
    <main className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        className="text-sm underline"
        params={{ estateId }}
        to="/estates/$estateId"
      >
        Back to estate
      </Link>
      <header>
        <h1 className="font-semibold text-2xl">Council members</h1>
        <p className="text-muted-foreground">{estate.data.name}</p>
      </header>
      {estate.data.canInviteMembers ? (
        <CouncilInvitationForm estateId={estateId} />
      ) : (
        <p>This estate is inactive. New invitations are disabled.</p>
      )}
      {canManage ? <OwnerInvitations estateId={estateId} /> : null}
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Invitation permissions</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Choose who can invite Council members. Only you can change these
              permissions.
            </p>
            {members.isPending ? <p>Loading members…</p> : null}
            {members.error ? <p role="alert">{members.error.message}</p> : null}
            {members.data?.length === 0 ? (
              <p className="mt-4">
                No members yet. Invite someone to get started.
              </p>
            ) : null}
            <ul>
              {members.data?.map((member) => (
                <MemberPermission
                  allowed={member.canInviteMembers}
                  email={member.email}
                  estateId={estateId}
                  key={member.userId}
                  name={member.name}
                  userId={member.userId}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
