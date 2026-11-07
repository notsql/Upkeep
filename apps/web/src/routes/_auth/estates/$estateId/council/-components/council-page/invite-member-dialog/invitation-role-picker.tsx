import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useEstateRoleAccess } from "@/lib/estate-roles";
import {
  type RoleOption,
  RolePicker,
} from "@/routes/_auth/estates/$estateId/council/-components/council-page/role-picker";

function canCreateRoles(
  estate: ReturnType<typeof useEstateRoleAccess>["estate"]
): boolean {
  return Boolean(estate?.canViewEstateRoles && estate.canCreateRoles);
}

/** The invitation role picker, plus "Create new role…" for role creators. */
export function InvitationRolePicker({
  estateId,
  options,
  value,
  disabled,
  onChange,
}: {
  estateId: string;
  options: RoleOption[];
  value: string;
  disabled: boolean;
  onChange: (option: RoleOption) => void;
}) {
  const navigate = useNavigate();
  const { estate } = useEstateRoleAccess(estateId);
  // Leaves the council page; the new-role page returns with ?inviteRole=<id>.
  const create = useCallback(() => {
    navigate({
      to: "/estates/$estateId/roles/new",
      params: { estateId },
      search: { returnTo: "council" },
    });
  }, [navigate, estateId]);
  return (
    <RolePicker
      disabled={disabled}
      label="Invitation role"
      onChange={onChange}
      onCreateRole={canCreateRoles(estate) ? create : undefined}
      options={options}
      value={value}
    />
  );
}
