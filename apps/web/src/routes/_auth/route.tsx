import type { components } from "@proj/api/schema";
import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { getSessionAccess, getSessionIdentity } from "@/lib/access-server";

import { buildSignInPath } from "@/lib/auth-redirect";

export const Route = createFileRoute("/_auth")({
  component: Outlet,
  beforeLoad: async ({ location, context }) => {
    const path = location.pathname;
    if (
      path === "/reports" ||
      path.startsWith("/reports/") ||
      path === "/account" ||
      path === "/invitations" ||
      path === "/invitations/"
    ) {
      const user = await getSessionIdentity();
      if (!user) {
        throw redirect({ href: buildSignInPath(location.href) });
      }
      return { user };
    }
    const { user, access } = await getSessionAccess();

    if (!user) {
      throw redirect({ href: buildSignInPath(location.href) });
    }

    if (!access) {
      throw new Error("Unable to resolve access.");
    }
    context.queryClient.setQueryData([user.id, "app-access"], access);
    if (path === "/estates" || path === "/estates/") {
      return { user };
    }
    if (path === "/estates/new" || path === "/estates/new/") {
      if (!access.canCreateEstate) {
        throw notFound();
      }
      return { user };
    }
    if (path.startsWith("/admin")) {
      if (!access.canAccessPlatformAdmin) {
        throw notFound();
      }
      return { user };
    }
    if (!access.canEnterWorkspace) {
      throw redirect({ href: "/reports/new" });
    }
    guardEstatePath(path, access);
    return { user };
  },
  loader: ({ context }) => ({ user: context.user }),
});

function guardEstatePath(
  path: string,
  access: components["schemas"]["AppAccessResponse"]
) {
  const [, , estateId, feature] = path.split("/");
  if (path.startsWith("/estates/") && estateId && estateId !== "new") {
    const estate = access.estates.find((item) => item.estateId === estateId);
    if (estate?.role === "RESIDENT") {
      throw redirect({ href: "/reports/new" });
    }
    if (feature === "reports") {
      if (!estate?.canViewFaultReports) {
        throw notFound();
      }
      return;
    }
    if (feature === "work-orders") {
      guardWorkOrders(path, estate);
      return;
    }

    if (!estate?.canViewManagement) {
      throw notFound();
    }
    if (feature === "assets" && !estate.canViewAssets) {
      throw notFound();
    }
    if (
      feature === "council" &&
      !(estate.canInviteMembers || estate.canManageInvitationPermissions)
    ) {
      throw notFound();
    }
  }
}

function guardWorkOrders(
  path: string,
  estate: components["schemas"]["EstateAccessResponse"] | undefined
) {
  if (!estate?.canViewWorkOrders) {
    throw notFound();
  }
  if (path.split("/")[4] === "new" && !estate.canCreateWorkOrders) {
    throw notFound();
  }
}
