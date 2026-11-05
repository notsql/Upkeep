import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { useSearch } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";

import { CouncilInvitationForm } from "@/routes/_auth/estates/$estateId/council/-components/council-page/invite-member-dialog/invitation-form";

export function InviteMemberDialog({ estateId }: { estateId: string }) {
  // Back from the new-role page: reopen with the created role selected.
  const search: { inviteRole?: unknown } = useSearch({ strict: false });
  const inviteRole =
    typeof search.inviteRole === "string" ? search.inviteRole : undefined;
  return (
    <Dialog defaultOpen={Boolean(inviteRole)}>
      <DialogTrigger render={<Button />}>
        <UserPlus aria-hidden="true" /> Invite member
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
