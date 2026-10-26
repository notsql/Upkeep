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
    if (path.startsWith("/estates/") && path.split("/")[3] === "work-orders") {
      const [, , estateId] = path.split("/");
      guardWorkOrders(
        path,
        access.estates.find((estate) => estate.estateId === estateId)
      );
      return { user };
    }
    if (path.startsWith("/estates/") && path.split("/")[3] === "documents") {
      guardDocuments(path, access);
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

function guardInspectionContext(
  path: string,
  estate: components["schemas"]["EstateAccessResponse"] | undefined
): boolean {
  const [, , , feature] = path.split("/");
  if (!feature && estate?.canViewEstateDetails) {
    return true;
  }
  if (feature !== "assets") {
    return false;
  }
  const segments = path.split("/").filter(Boolean).slice(3);
  if (segments.length === 3 && segments[1] === "inspections") {
    const allowed =
      segments[2] === "new"
        ? estate?.canCreateInspectionResults
        : estate?.canViewInspectionResults;
    if (!allowed) {
      throw notFound();
    }
    return true;
  }
  const context =
    segments.length === 0 || (segments.length === 1 && segments[0] !== "new");
  return context && !!estate?.canViewInspectionResults;
}

function guardEstatePath(
  path: string,
  access: components["schemas"]["AppAccessResponse"]
) {
  const [, , estateId, feature] = path.split("/");
  if (!(path.startsWith("/estates/") && estateId) || estateId === "new") {
    return;
  }
  const estate = access.estates.find((item) => item.estateId === estateId);
  if (estate?.role === "RESIDENT") {
    throw redirect({ href: "/reports/new" });
  }
  if (guardInspectionContext(path, estate)) {
    return;
  }
  switch (feature) {
    case "reports":
      if (!estate?.canViewFaultReports) {
        throw notFound();
      }
      return;
    case "roles":
      if (!estate?.canViewEstateRoles) {
        throw notFound();
      }
      return;
    case "council":
      if (
        !(
          estate?.canViewEstateInvitations ||
          estate?.canInviteMembers ||
          estate?.canManageInvitationPermissions
        )
      ) {
        throw notFound();
      }
      return;
    default:
      if (
        !estate?.canViewManagement ||
        (feature === "assets" && !estate.canViewAssets)
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

function guardDocuments(
  path: string,
  access: components["schemas"]["AppAccessResponse"]
) {
  const estate = access.estates.find(
    (item) => item.estateId === path.split("/")[2]
  );
  if (!estate?.canViewDocuments) {
    throw notFound();
  }
}
