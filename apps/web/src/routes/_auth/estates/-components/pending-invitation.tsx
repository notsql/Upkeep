import type { components } from "@proj/api/schema";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { useCallback } from "react";
import { useAcceptInAppInvitation } from "@/lib/council-invitations";

export function PendingInvitation({
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
