import type { components } from "@proj/api/schema";

export function InactiveNote({
  permission,
}: {
  permission: components["schemas"]["EstateAccessResponse"];
}) {
  return permission.canInviteMembers ? null : (
    <p className="text-muted-foreground text-sm">
      This estate is inactive. New invitations are disabled.
    </p>
  );
}
