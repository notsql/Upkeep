import type { useCouncilInvitation } from "@/lib/council-invitations";

export function InvitationFormOutcome({
  invitation,
}: {
  invitation: ReturnType<typeof useCouncilInvitation>;
}) {
  return (
    <>
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
    </>
  );
}
