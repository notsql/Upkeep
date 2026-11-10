import { MailOpen } from "lucide-react";
import { useCallback } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { usePendingCouncilInvitations } from "@/lib/council-invitations";
import { PendingInvitation } from "@/routes/_auth/estates/-components/estate-list-page/pending-invitation";

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
      <div className="my-4">
        <ErrorState
          message={invitations.error.message}
          onRetry={retry}
          retryLabel="Retry pending invitations"
        />
      </div>
    );
  }
  if (!invitations.data?.length) {
    if (showEmpty && invitations.isSuccess) {
      return (
        <div className="my-4">
          <EmptyState
            description="Estate invitations appear here"
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
