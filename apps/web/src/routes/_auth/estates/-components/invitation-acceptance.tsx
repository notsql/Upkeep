import { useCallback, useEffect, useRef } from "react";
import { ErrorState } from "@/components/error-state";
import { useAcceptCouncilInvitations } from "@/lib/council-invitations";
import { useEstateSession } from "@/lib/estates";

export function InvitationAcceptance() {
  const { userId, ready } = useEstateSession();
  const checkedUser = useRef<string | undefined>(undefined);
  const { mutate, error, data } = useAcceptCouncilInvitations();
  useEffect(() => {
    if (ready && userId !== checkedUser.current) {
      checkedUser.current = userId;
      mutate();
    }
  }, [mutate, ready, userId]);
  const retry = useCallback(() => mutate(), [mutate]);
  if (error) {
    return (
      <div className="my-4">
        <ErrorState
          message={error.message}
          onRetry={retry}
          retryLabel="Retry invitations"
        />
      </div>
    );
  }
  if (data && data.estateIds.length > 0) {
    return (
      <p className="my-4" role="status">
        Estate access updated. Your accepted invitations are ready.
      </p>
    );
  }
  return null;
}
