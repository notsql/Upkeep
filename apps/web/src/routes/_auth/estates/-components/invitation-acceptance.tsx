import { Button } from "@proj/ui/components/button";
import { useCallback, useEffect, useRef } from "react";
import { useAcceptCouncilInvitations } from "@/lib/council-invitations";
import { useEstateSession } from "@/lib/estates";

export function InvitationAcceptance() {
  const { userId, ready } = useEstateSession();
  const checkedUser = useRef<string | undefined>(undefined);
  const { mutate, error, data, isPending } = useAcceptCouncilInvitations();
  useEffect(() => {
    if (ready && userId !== checkedUser.current) {
      checkedUser.current = userId;
      mutate();
    }
  }, [mutate, ready, userId]);
  const retry = useCallback(() => mutate(), [mutate]);
  if (error) {
    return (
      <div className="my-4 space-y-2">
        <p role="alert">{error.message}</p>
        <Button disabled={isPending} onClick={retry} variant="outline">
          Retry invitations
        </Button>
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
