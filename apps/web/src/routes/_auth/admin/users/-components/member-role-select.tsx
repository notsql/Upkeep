import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback } from "react";
import type { Role } from "@/routes/_auth/admin/users/-components/admin-user-types";

interface MemberRoleSelectProps {
  currentRole: string;
  disabled: boolean;
  membershipId?: string;
  name: string;
  onRoleChange: (membershipId: string, role: string) => void;
  roles: Role[];
}

export function MemberRoleSelect({
  currentRole,
  disabled,
  membershipId,
  name,
  onRoleChange,
  roles,
}: MemberRoleSelectProps) {
  const currentRoleMissing =
    Boolean(currentRole) && !roles.some((role) => role.slug === currentRole);
  const items = [
    { value: "", label: "Select a role" },
    ...(currentRoleMissing ? [{ value: currentRole, label: currentRole }] : []),
    ...roles.map((role) => ({
      value: role.slug ?? "",
      label: role.name ?? role.slug ?? "",
    })),
  ];

  const changeRole = useCallback(
    (role: string | null) => {
      if (!(membershipId && role) || role === currentRole) {
        return;
      }
      onRoleChange(membershipId, role);
    },
    [currentRole, membershipId, onRoleChange]
  );

  return (
    <Select
      disabled={disabled}
      items={items}
      onValueChange={changeRole}
      value={currentRole}
    >
      <SelectTrigger aria-label={`Role for ${name}`} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem disabled value="">
          Select a role
        </SelectItem>
        {currentRoleMissing ? (
          <SelectItem disabled value={currentRole}>
            {currentRole}
          </SelectItem>
        ) : null}
        {roles.map((role) => (
          <SelectItem key={role.slug} value={role.slug}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
