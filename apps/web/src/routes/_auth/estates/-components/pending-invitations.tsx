import type { components } from "@proj/api/schema";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { MailOpen } from "lucide-react";
import { useCallback } from "react";
import { EmptyState } from "@/components/empty-state";
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
    <li>
      <Alert role="none">
        <AlertTitle>You're invited to {invitation.estateName}</AlertTitle>
        <AlertDescription>
          Offered role: {roleName} · Expires{" "}
          {new Date(invitation.expiresAt).toLocaleDateString()}
          {acceptance.error ? (
            <p className="text-destructive" role="alert">
              {acceptance.error.message}
            </p>
          ) : null}
        </AlertDescription>
        <AlertAction>
          <Button
            aria-label={`Accept invitation to ${invitation.estateName}`}
            disabled={
              acceptance.isPending ||
              acceptance.isSuccess ||
              (invitation.role === "CUSTOM" && !invitation.customRoleVersion)
            }
            onClick={accept}
            size="sm"
          >
            {acceptance.isPending ? "Accepting…" : "Accept"}
          </Button>
        </AlertAction>
      </Alert>
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
        <div className="my-4">
          <EmptyState
            description="You have no estate invitations to review right now."
            icon={MailOpen}
            title="No pending invitations"
          />
        </div>
      );
    }
    return null;
  }
  return (
    <ul aria-label="Pending estate invitations" className="mb-6 space-y-2">
      {invitations.data.map((invitation) => (
        <PendingInvitation invitation={invitation} key={invitation.id} />
      ))}
    </ul>
  );
}
