import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { MailX } from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import {
  useCancelCouncilInvitation,
  useOutstandingInvitations,
  useRemoveEstateMember,
} from "@/lib/council-invitations";
import { useEstateSession } from "@/lib/estates";
import { AccessConfirmation } from "@/routes/_auth/estates/$estateId/council/-components/access-confirmation";
import {
  type MemberFilter,
  matchesFilter,
} from "@/routes/_auth/estates/$estateId/council/-components/member-filters";
import { presetOptions } from "@/routes/_auth/estates/$estateId/council/-components/role-picker";

export function RemoveMemberButton({
  estateId,
  memberId,
  email,
}: {
  estateId: string;
  memberId: string;
  email: string;
}) {
  const { userId } = useEstateSession();
  const removal = useRemoveEstateMember(estateId);
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const confirm = useCallback(
    () => removal.mutateAsync(memberId),
    [memberId, removal]
  );
  if (userId === memberId) {
    return null;
  }
  return (
    <>
      <Button
        aria-label={`Remove access for ${email}`}
        onClick={show}
        variant="destructive"
      >
        Remove access
      </Button>
      {open ? (
        <AccessConfirmation
          confirmLabel="Remove access"
          description="They will lose access and invitation permission for this estate. Outstanding invitations they sent will be cancelled. Their account, access to other estates, and members who already accepted their invitations will remain."
          email={email}
          keepLabel="Keep access"
          onClose={close}
          onConfirm={confirm}
          title="Remove estate access?"
        />
      ) : null}
    </>
  );
}

function OutstandingInvitation({
  estateId,
  invitation,
}: {
  estateId: string;
  invitation: components["schemas"]["CouncilInvitationResponse"];
}) {
  const cancellation = useCancelCouncilInvitation(estateId);
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const confirm = useCallback(
    () => cancellation.mutateAsync(invitation.id),
    [cancellation, invitation.id]
  );
  let delivery = "Email invitation";
  if (invitation.status === "IN_APP") {
    delivery = "Accepts on Invitations";
  }
  if (invitation.status === "SENDING") {
    delivery = "Sending or awaiting retry";
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="grid min-w-0 gap-1">
        <p className="font-medium break-all">{invitation.email}</p>
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">
            {invitation.customRoleName ??
              presetOptions.find((option) => option.role === invitation.role)
                ?.label ??
              invitation.role}
          </Badge>
          <span>
            {delivery}
            {invitation.expiresAt
              ? ` · Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
              : ""}
          </span>
        </p>
      </div>
      <Button
        aria-label={`Cancel invitation for ${invitation.email}`}
        onClick={show}
        size="sm"
        variant="outline"
      >
        Revoke
      </Button>
      {open ? (
        <AccessConfirmation
          confirmLabel="Cancel invitation"
          description="This invitation will no longer grant access to this estate. An email already sent may still allow account registration."
          email={invitation.email}
          keepLabel="Keep invitation"
          onClose={close}
          onConfirm={confirm}
          title="Cancel invitation?"
        />
      ) : null}
    </li>
  );
}

export function OwnerInvitations({
  estateId,
  filter,
  onClearFilters,
}: {
  estateId: string;
  filter?: MemberFilter;
  onClearFilters?: () => void;
}) {
  const invitations = useOutstandingInvitations(estateId);
  const visible = (invitations.data ?? []).filter((invitation) =>
    filter
      ? matchesFilter(filter, {
          text: [invitation.email],
          role: invitation.customRoleId ?? invitation.role,
        })
      : true
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <h2>Pending invitations</h2>
          {invitations.data ? (
            <Badge variant="outline">{invitations.data.length} pending</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Invitations not yet accepted. Revoking stops them granting access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.isPending ? (
          <LoadingState label="Loading invitations…" />
        ) : null}
        {invitations.error ? (
          <p role="alert">{invitations.error.message}</p>
        ) : null}
        {invitations.data?.length === 0 ? (
          <EmptyState
            description="Invitations you send appear here until they are accepted."
            icon={MailX}
            title="No pending invitations"
          />
        ) : null}
        {invitations.data?.length && !visible.length ? (
          <EmptyState
            action={
              onClearFilters ? (
                <Button onClick={onClearFilters} variant="outline">
                  Clear filters
                </Button>
              ) : undefined
            }
            icon={MailX}
            title="No matching invitations"
          />
        ) : null}
        {visible.length ? (
          <ul aria-label="Outstanding invitations" className="divide-y">
            {visible.map((invitation) => (
              <OutstandingInvitation
                estateId={estateId}
                invitation={invitation}
                key={invitation.id}
              />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
