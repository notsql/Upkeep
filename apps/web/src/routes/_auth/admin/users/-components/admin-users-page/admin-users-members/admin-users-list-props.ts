import type { MouseEvent } from "react";
import type {
  Member,
  Role,
} from "@/routes/_auth/admin/users/-components/admin-users-page/admin-user-types";

/** What the member cards and the member table both need to draw a row. */
export interface AdminUsersListProps {
  onManage: (event: MouseEvent<HTMLButtonElement>) => void;
  onRoleChange: (membershipId: string, role: string) => void;
  pending: boolean;
  roles: Role[];
  rolesUnavailable: boolean;
  users: Member[];
}
