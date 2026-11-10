import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { useIsMobile } from "@proj/ui/hooks/use-mobile";
import { useSearch } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";

import { CouncilInvitationForm } from "@/routes/_auth/estates/$estateId/council/-components/council-page/invite-member-dialog/invitation-form";

export function InviteMemberDialog({ estateId }: { estateId: string }) {
  // Back from the new-role page: reopen with the created role selected.
  const search: { inviteRole?: unknown } = useSearch({ strict: false });
  const inviteRole =
    typeof search.inviteRole === "string" ? search.inviteRole : undefined;
  // Icon-only on mobile, like CreateButton; the aria-label keeps the name.
  const mobile = useIsMobile();
  return (
    <Dialog defaultOpen={Boolean(inviteRole)}>
      <DialogTrigger
        render={
          <Button
            aria-label={mobile ? "Invite member" : undefined}
            size={mobile ? "icon" : "default"}
          />
        }
      >
        <UserPlus aria-hidden="true" />
        {mobile ? null : " Invite member"}
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            New users get an email · existing users accept on Invitations
          </DialogDescription>
        </DialogHeader>
        <CouncilInvitationForm estateId={estateId} initialRole={inviteRole} />
      </DialogContent>
    </Dialog>
  );
}
