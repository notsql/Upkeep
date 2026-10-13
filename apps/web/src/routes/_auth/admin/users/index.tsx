import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { AdminUsersPage } from "@/routes/_auth/admin/users/-components/admin-users-page";

export const Route = createFileRoute("/_auth/admin/users/")({
  component: AdminUsersPage,
  loader: async () => {
    const auth = await getAuth();
    if (!auth.user || auth.role !== "admin") {
      throw redirect({ to: "/estates" });
    }
  },
});
