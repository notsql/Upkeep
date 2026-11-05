import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import type { AdminUsersListProps } from "@/routes/_auth/admin/users/-components/admin-users-list-props";
import { ManageEstateButton } from "@/routes/_auth/admin/users/-components/manage-estate-button";
import { RoleEditor } from "@/routes/_auth/admin/users/-components/role-editor";

export function AdminUsersTable({
  users,
  roles,
  rolesUnavailable,
  pending,
  onRoleChange,
  onManage,
}: AdminUsersListProps) {
  return (
    <Table aria-label="Admin users" className="min-w-[640px] text-sm">
      <TableCaption className="sr-only">Users and assigned roles</TableCaption>
      <TableHeader className="bg-muted text-xs tracking-wide uppercase">
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-muted-foreground px-5 py-3" scope="col">
            User
          </TableHead>
          <TableHead className="text-muted-foreground px-5 py-3" scope="col">
            Joined
          </TableHead>
          <TableHead className="text-muted-foreground px-5 py-3" scope="col">
            Current role
          </TableHead>
          <TableHead className="text-muted-foreground px-5 py-3" scope="col">
            Estates
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {users.map((user) => {
          const name = user.name || user.email || "Unnamed member";

          return (
            <TableRow key={user.membershipId ?? user.userId ?? user.email}>
              <TableCell className="px-5 py-4">
                <p className="font-medium">{name}</p>
                <p className="text-muted-foreground mt-1">{user.email}</p>
              </TableCell>
              <TableCell className="text-muted-foreground px-5 py-4">
                {user.joined ? new Date(user.joined).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell className="px-5 py-4">
                <RoleEditor
                  name={name}
                  onRoleChange={onRoleChange}
                  pending={pending}
                  roles={roles}
                  rolesUnavailable={rolesUnavailable}
                  user={user}
                />
              </TableCell>
              <TableCell className="px-5 py-4">
                <ManageEstateButton
                  name={name}
                  onManage={onManage}
                  user={user}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
