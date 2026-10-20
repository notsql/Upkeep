import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useCallback, useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  useCouncilInvitation,
  useEstateMembers,
  useTransferOwnership,
  useUpdateEstateRole,
} from "@/lib/council-invitations";
import { useEstate, useEstateSession } from "@/lib/estates";
import { AccessConfirmation } from "@/routes/_auth/estates/$estateId/council/-components/access-confirmation";
import {
  OwnerInvitations,
  RemoveMemberButton,
} from "@/routes/_auth/estates/$estateId/council/-components/access-controls";

type Role = NonNullable<
  components["schemas"]["CouncilInvitationRequest"]["role"]
>;
const roles: { value: Role; label: string }[] = [
  { value: "COUNCIL", label: "Council member" },
  { value: "RESIDENT", label: "Resident" },
  { value: "MANAGER", label: "Manager (Admin)" },
  { value: "CREW", label: "Crew" },
];

function RolePicker({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (role: Role | null) => void;
  label: string;
  disabled?: boolean;
}) {
  const change = useCallback(
    (selected: string | null) =>
      onChange(roles.find((role) => role.value === selected)?.value ?? null),
    [onChange]
  );
  return (
    <Select
      disabled={disabled}
      items={roles}
      onValueChange={change}
      value={value}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MemberPermission({
  estateId,
  member,
  canTransfer,
}: {
  estateId: string;
  member: components["schemas"]["EstateMemberResponse"];
  canTransfer: boolean;
}) {
  const { userId } = useEstateSession();
  const update = useUpdateEstateRole(estateId);
  const transfer = useTransferOwnership(estateId);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const change = useCallback(
    (role: Role | null) => {
      if (role) {
        update.mutate({ memberId: member.userId, body: { role } });
      }
    },
    [member.userId, update]
  );
  const showTransfer = useCallback(() => setConfirmTransfer(true), []);
  const closeTransfer = useCallback(() => setConfirmTransfer(false), []);
  const confirm = useCallback(
    () => transfer.mutateAsync(member.userId),
    [member.userId, transfer]
  );
  const self = userId === member.userId;
  return (
    <li className="grid gap-3 rounded-lg border p-3">
      <p className="break-words font-medium">{member.name}</p>
      <p className="break-all text-muted-foreground text-sm">{member.email}</p>
      {member.owner ? <Badge>Owner</Badge> : null}
      <p>
        {roles.find((role) => role.value === member.role)?.label ?? member.role}
      </p>
      {self || member.owner ? (
        <p className="text-muted-foreground text-sm">
          {member.owner
            ? "Transfer ownership before changing this member’s access."
            : "Another Manager must change or remove your access."}
        </p>
      ) : (
        <>
          <RolePicker
            disabled={update.isPending}
            label={`Role for ${member.name}`}
            onChange={change}
            value={member.role}
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
      {update.error ? <p role="alert">{update.error.message}</p> : null}
      {canTransfer && !self && !member.owner && member.role === "MANAGER" ? (
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
    </li>
  );
}

function CouncilInvitationForm({ estateId }: { estateId: string }) {
  const invitation = useCouncilInvitation(estateId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | null>("COUNCIL");
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (invitation.isPending) {
        return;
      }
      invitation.mutate(
        { email: email.trim(), role: role ?? "COUNCIL" },
        {
          onSuccess: () => {
            setEmail("");
          },
        }
      );
    },
    [email, invitation, role]
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
          <h2>Invite an estate member</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-muted-foreground text-sm">
          New users receive an email invitation. Existing users accept on
          Invitations. Existing accounts keep their current access.
        </p>
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
            disabled={invitation.isPending}
            label="Invitation role"
            onChange={setRole}
            value={role ?? "COUNCIL"}
          />
          <Button
            disabled={invitation.isPending || !email.trim()}
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
      </CardContent>
    </Card>
  );
}

export function CouncilPage({ estateId }: { estateId: string }) {
  const estate = useEstate(estateId);
  const canManage = estate.data?.canManageInvitationPermissions === true;
  const members = useEstateMembers(estateId, canManage);
  if (estate.isPending) {
    return (
      <p className="sm:col-span-2" role="status">
        Loading estate…
      </p>
    );
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
    <main className="page-layout space-y-6">
      <Link
        className="text-sm underline"
        params={{ estateId }}
        to="/estates/$estateId"
      >
        Back to estate
      </Link>
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate.data.name,
            to: "/estates/$estateId",
            params: { estateId },
          },
          { label: "Estate members" },
        ]}
        description={`Invitations and estate access for ${estate.data.name}.`}
        title="Estate members"
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {estate.data.canInviteMembers ? (
          <CouncilInvitationForm estateId={estateId} />
        ) : (
          <p>This estate is inactive. New invitations are disabled.</p>
        )}
        {canManage ? <OwnerInvitations estateId={estateId} /> : null}
      </div>
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Estate roles</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Choose who can invite Estate members. Only you can change these
              permissions.
            </p>
            {members.isPending ? <p>Loading members…</p> : null}
            {members.error ? <p role="alert">{members.error.message}</p> : null}
            {members.data?.length === 0 ? (
              <p className="mt-4">
                No members yet. Invite someone to get started.
              </p>
            ) : null}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {members.data?.map((member) => (
                <MemberPermission
                  canTransfer={estate.data.owned}
                  estateId={estateId}
                  key={member.userId}
                  member={member}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
