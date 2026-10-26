import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { InvitationAcceptance } from "@/routes/_auth/estates/-components/invitation-acceptance";
import { PendingInvitations } from "@/routes/_auth/estates/-components/pending-invitations";

export const Route = createFileRoute("/_auth/invitations/")({
  component: InvitationsPage,
  head: () => ({ meta: [{ title: "Estate invitations" }] }),
});

function InvitationsPage() {
  return (
    <main className="page-layout">
      <PageHeader
        description="Review the estate and offered role before accepting an invitation."
        title="Estate invitations"
      />
      <InvitationAcceptance />
      <PendingInvitations showEmpty />
    </main>
  );
}
