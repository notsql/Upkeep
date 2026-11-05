import { Button } from "@proj/ui/components/button";
import type { MouseEvent } from "react";
import type { Member } from "@/routes/_auth/admin/users/-components/admin-user-types";

export function ManageEstateButton({
  user,
  name,
  onManage,
}: {
  user: Member;
  name: string;
  onManage: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Button
      aria-label={`Manage estates for ${name}`}
      data-member-name={name}
      data-user-id={user.userId}
      disabled={!user.userId}
      onClick={onManage}
      size="sm"
      type="button"
      variant="outline"
    >
      Manage estates
    </Button>
  );
}
