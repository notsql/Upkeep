import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import type { RefObject } from "react";
import { MemberEstates } from "@/routes/_auth/admin/-components/member-estates";
import type { SelectedMember } from "@/routes/_auth/admin/users/-components/use-admin-users-page";

export function AdminUsersAccessDialog({
  selectedMember,
  onOpenChange,
  returnFocus,
  pending,
  onPendingChange,
}: {
  selectedMember: SelectedMember | undefined;
  onOpenChange: (open: boolean) => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(selectedMember)}>
      {selectedMember ? (
        <DialogContent
          className="sm:max-w-xl"
          finalFocus={returnFocus}
          showCloseButton={!pending}
        >
          <DialogHeader>
            <DialogTitle>Estate access for {selectedMember.name}</DialogTitle>
            <DialogDescription>
              Changes save automatically. Estate owners retain their access.
            </DialogDescription>
          </DialogHeader>
          <MemberEstates
            key={selectedMember.userId}
            name={selectedMember.name}
            onPendingChange={onPendingChange}
            showTitle={false}
            userId={selectedMember.userId}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
