import { Card } from "@proj/ui/components/card";
import type { AdminUsersListProps } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/admin-users-list-props";
import { ManageEstateButton } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/manage-estate-button";
import { RoleEditor } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/role-editor";

export function AdminUsersMemberCards({
  users,
  roles,
  rolesUnavailable,
  pending,
  onRoleChange,
  onManage,
}: AdminUsersListProps) {
  return (
    <ul aria-label="Members" className="grid gap-3 p-4">
      {users.map((user) => {
        const name = user.name || user.email || "Unnamed member";
        return (
          <li key={user.membershipId ?? user.userId ?? user.email}>
            <Card className="gap-3 p-4">
              <div>
                <h3 className="font-semibold break-words">{name}</h3>
                <p className="text-muted-foreground text-sm break-all">
                  {user.email}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                Joined{" "}
                {user.joined ? new Date(user.joined).toLocaleDateString() : "—"}
              </p>
              <RoleEditor
                name={name}
                onRoleChange={onRoleChange}
                pending={pending}
                roles={roles}
                rolesUnavailable={rolesUnavailable}
                user={user}
              />
              <ManageEstateButton name={name} onManage={onManage} user={user} />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
