import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@proj/ui/components/empty";
import { useCallback } from "react";
import {
  useAcceptInAppInvitation,
  usePendingCouncilInvitations,
} from "@/lib/council-invitations";

function PendingInvitation({
  invitation,
}: {
  invitation: components["schemas"]["PendingCouncilInvitationResponse"];
}) {
  const acceptance = useAcceptInAppInvitation();
  const accept = useCallback(() => {
    if (invitation.role === "CUSTOM") {
      if (!invitation.customRoleVersion) {
        return;
      }
      acceptance.mutate({
        invitationId: invitation.id,
        body: { expectedRoleVersion: invitation.customRoleVersion },
      });
    } else {
      acceptance.mutate(invitation.id);
    }
  }, [
    acceptance,
    invitation.id,
    invitation.role,
    invitation.customRoleVersion,
  ]);
  let roleName = invitation.role?.toLowerCase();
  if (invitation.role === "MANAGER") {
    roleName = "Manager (Admin)";
  }
  if (invitation.role === "CUSTOM") {
    roleName = invitation.customRoleName ?? "Unavailable custom role";
  }
  return (
    <li className="space-y-2 border-b py-4 last:border-b-0">
      <p className="font-medium">{invitation.estateName}</p>
      <p>Offered role: {roleName}</p>
      <p className="text-muted-foreground text-sm">
        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
      </p>
      <Button
        aria-label={`Accept invitation to ${invitation.estateName}`}
        disabled={
          acceptance.isPending ||
          acceptance.isSuccess ||
          (invitation.role === "CUSTOM" && !invitation.customRoleVersion)
        }
        onClick={accept}
      >
        {acceptance.isPending ? "Accepting…" : "Accept invitation"}
      </Button>
      {acceptance.error ? <p role="alert">{acceptance.error.message}</p> : null}
    </li>
  );
}

export function PendingInvitations({
  showEmpty = false,
}: {
  showEmpty?: boolean;
}) {
  const invitations = usePendingCouncilInvitations();
  const retry = useCallback(() => {
    invitations.refetch();
  }, [invitations]);
  if (invitations.error) {
    return (
      <div className="my-4 space-y-2">
        <p role="alert">{invitations.error.message}</p>
        <Button
          disabled={invitations.isFetching}
          onClick={retry}
          variant="outline"
        >
          Retry pending invitations
        </Button>
      </div>
    );
  }
  if (!invitations.data?.length) {
    if (showEmpty && invitations.isSuccess) {
      return (
        <Empty className="my-4 rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyTitle>
              <h2>No pending invitations</h2>
            </EmptyTitle>
            <EmptyDescription>
              You have no estate invitations to review right now.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }
    return null;
  }
  return (
    <Card className="my-4">
      <CardHeader>
        <CardTitle>
          <h2>Pending estate invitations</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          Accept an invitation to gain the offered role in that estate. Your
          existing access stays unchanged.
        </p>
        <ul>
          {invitations.data.map((invitation) => (
            <PendingInvitation invitation={invitation} key={invitation.id} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
