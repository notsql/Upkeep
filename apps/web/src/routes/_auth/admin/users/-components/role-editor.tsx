import type {
  Member,
  Role,
} from "@/routes/_auth/admin/users/-components/admin-user-types";
import { MemberRoleSelect } from "@/routes/_auth/admin/users/-components/member-role-select";

export function RoleEditor({
  user,
  name,
  pending,
  rolesUnavailable,
  roles,
  onRoleChange,
}: {
  user: Member;
  name: string;
  pending: boolean;
  rolesUnavailable: boolean;
  roles: Role[];
  onRoleChange: (membershipId: string, role: string) => void;
}) {
  return (
    <div className="grid gap-1">
      {" "}
      <MemberRoleSelect
        currentRole={user.roleSlugs?.[0] ?? ""}
        disabled={
          pending ||
          rolesUnavailable ||
          (user.roleSlugs?.length ?? 0) > 1 ||
          !user.membershipId
        }
        membershipId={user.membershipId}
        name={name}
        onRoleChange={onRoleChange}
        roles={roles}
      />
      {(user.roleSlugs?.length ?? 0) > 1 && (
        <p className="text-muted-foreground mt-1 text-xs">
          Manage multiple roles in WorkOS.
        </p>
      )}
    </div>
  );
}
