import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import { useRemoveEstateMember } from "@/lib/council-invitations";
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
