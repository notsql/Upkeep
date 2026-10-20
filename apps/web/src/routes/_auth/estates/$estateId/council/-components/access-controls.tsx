import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { useCallback, useState } from "react";
import {
  useCancelCouncilInvitation,
  useOutstandingInvitations,
  useRemoveEstateMember,
} from "@/lib/council-invitations";
import { useEstateSession } from "@/lib/estates";
import { AccessConfirmation } from "@/routes/_auth/estates/$estateId/council/-components/access-confirmation";

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
    <li className="grid gap-2 rounded-lg border p-3">
      <p className="break-all font-medium">{invitation.email}</p>
      <p className="text-muted-foreground text-sm">
        {invitation.role} · {delivery}
        {invitation.expiresAt
          ? ` · Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
          : ""}
      </p>
      <Button
        aria-label={`Cancel invitation for ${invitation.email}`}
        onClick={show}
        variant="outline"
      >
        Cancel invitation
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

export function OwnerInvitations({ estateId }: { estateId: string }) {
  const invitations = useOutstandingInvitations(estateId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Pending invitations</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invitations.isPending ? <p>Loading invitations…</p> : null}
        {invitations.error ? (
          <p role="alert">{invitations.error.message}</p>
        ) : null}
        {invitations.data?.length === 0 ? <p>No pending invitations.</p> : null}
        <ul aria-label="Outstanding invitations" className="grid gap-3">
          {invitations.data?.map((invitation) => (
            <OutstandingInvitation
              estateId={estateId}
              invitation={invitation}
              key={invitation.id}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
