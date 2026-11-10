import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemSeparator,
  ItemTitle,
} from "@proj/ui/components/item";
import type { AdminUsersListProps } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/admin-users-list-props";
import { ManageEstateButton } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/manage-estate-button";
import { RoleEditor } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/role-editor";

/** The phone layout of the members: one list item per member. */
export function AdminUsersMemberList({
  users,
  roles,
  rolesUnavailable,
  pending,
  onRoleChange,
  onManage,
}: AdminUsersListProps) {
  return (
    <ul aria-label="Admin users" className="flex flex-col p-2">
      {users.map((user, index) => {
        const name = user.name || user.email || "Unnamed member";
        const roleNames = (user.roleSlugs ?? []).map(
          (slug) => roles.find((role) => role.slug === slug)?.name ?? slug
        );
        const summary = [user.email, roleNames.join(", ")]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={user.membershipId ?? user.userId ?? user.email}>
            {index > 0 ? <ItemSeparator className="my-0" /> : null}
            <Item size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle className="[overflow-wrap:anywhere]">
                  {name}
                </ItemTitle>
                <ItemDescription className="[overflow-wrap:anywhere]">
                  {summary}
                </ItemDescription>
                {user.joined ? (
                  <p className="text-muted-foreground text-xs">
                    Joined {new Date(user.joined).toLocaleDateString()}
                  </p>
                ) : null}
              </ItemContent>
              <ItemActions>
                <ManageEstateButton
                  name={name}
                  onManage={onManage}
                  user={user}
                />
              </ItemActions>
              <ItemFooter className="block">
                <RoleEditor
                  name={name}
                  onRoleChange={onRoleChange}
                  pending={pending}
                  roles={roles}
                  rolesUnavailable={rolesUnavailable}
                  user={user}
                />
              </ItemFooter>
            </Item>
          </li>
        );
      })}
    </ul>
  );
}
