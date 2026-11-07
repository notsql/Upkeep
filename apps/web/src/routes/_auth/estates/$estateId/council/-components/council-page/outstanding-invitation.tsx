import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import { useCancelCouncilInvitation } from "@/lib/council-invitations";
import { AccessConfirmation } from "@/routes/_auth/estates/$estateId/council/-components/council-page/access-confirmation";
import { presetOptions } from "@/routes/_auth/estates/$estateId/council/-components/council-page/role-picker";

export function OutstandingInvitation({
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
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="grid min-w-0 gap-1">
        <p className="font-medium break-all">{invitation.email}</p>
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">
            {invitation.customRoleName ??
              presetOptions.find((option) => option.role === invitation.role)
                ?.label ??
              invitation.role}
          </Badge>
          <span>
            {delivery}
            {invitation.expiresAt
              ? ` · Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
              : ""}
          </span>
        </p>
      </div>
      <Button
        aria-label={`Cancel invitation for ${invitation.email}`}
        onClick={show}
        size="sm"
        variant="ghost"
      >
        Revoke
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
