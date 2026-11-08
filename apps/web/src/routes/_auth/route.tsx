import type { components } from "@proj/api/schema";
import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import {
  getSessionAccess,
  getSessionEstate,
  getSessionIdentity,
} from "@/lib/access-server";

import { buildSignInPath } from "@/lib/auth-redirect";
import {
  canOpenAssetCategories,
  canOpenAssets,
  canOpenDevices,
  canOpenEstateSettings,
  canOpenFailureRisk,
  canOpenInspections,
  canOpenNotificationSettings,
  canOpenSensors,
} from "@/lib/estate-destinations";

type EstatePermission = components["schemas"]["EstateAccessResponse"];
type DestinationPredicate = (
  permission: EstatePermission | undefined,
  owned?: boolean,
  platformAdmin?: boolean
) => boolean;

// Sections the sidebar gates on ownership; the guard uses the same predicates.
const OWNER_GATED: Record<string, DestinationPredicate> = {
  devices: canOpenDevices,
  "asset-categories": canOpenAssetCategories,
  inspections: canOpenInspections,
  sensors: canOpenSensors,
  "failure-risk": canOpenFailureRisk,
  edit: canOpenEstateSettings,
  "notification-settings": canOpenNotificationSettings,
};

// Sections whose sub-views (one segment deeper) share the section's gate.
const SUB_VIEW_SECTIONS = new Set(["sensors", "asset-categories"]);

/** True for a section root (/estates/:id/:feature) or one of its sub-views. */
function isSectionPath(segments: string[], feature: string | undefined) {
  return (
    segments.length === 3 ||
    (segments.length === 4 &&
      feature !== undefined &&
      SUB_VIEW_SECTIONS.has(feature))
  );
}

const PERSONAL_PATHS = new Set([
  "/reports",
  "/account",
  "/invitations",
  "/invitations/",
]);

export const Route = createFileRoute("/_auth")({
  component: Outlet,
  beforeLoad: async ({ location, context }) => {
    const path = location.pathname;
    if (PERSONAL_PATHS.has(path) || path.startsWith("/reports/")) {
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
    if (guardFeaturePath(path, access)) {
      return { user };
    }
    if (!access.canEnterWorkspace) {
      throw redirect({ href: "/reports/new" });
    }
    guardEstatePath(path, access);
    await guardDestination(path, access, async (estateId) => {
      try {
        const estate = await context.queryClient.ensureQueryData({
          queryKey: ["estates", user.id, "details", estateId],
          queryFn: async () => {
            const result = await getSessionEstate({ data: estateId });
            if (!result) {
              throw new Error("Unable to load the estate.");
            }
            return result;
          },
        });
        return Boolean(estate.owned);
      } catch {
        return false;
      }
    });
    return { user };
  },
  loader: ({ context }) => ({ user: context.user }),
});

function guardInspectionContext(
  path: string,
  estate: components["schemas"]["EstateAccessResponse"] | undefined
): boolean {
  if (guardHistoryContext(path, estate)) {
    return true;
  }
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
  // The asset page and its Inspections sub-page are open to inspection viewers.
  const context =
    segments.length === 0 ||
    (segments.length === 1 && segments[0] !== "new") ||
    (segments.length === 2 && segments[1] === "inspections");
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
      if (checkedByDestination(path, feature)) {
        return;
      }
      if (
        !estate?.canViewManagement ||
        (feature === "assets" && !estate.canViewAssets)
      ) {
        throw notFound();
      }
  }
}

function guardHistoryContext(
  path: string,
  estate: EstatePermission | undefined
): boolean {
  const segments = path.split("/").filter(Boolean);
  if (segments[2] !== "assets" || !estate?.canViewAssetHistory) {
    return false;
  }
  return (
    (segments.length === 4 && segments[3] !== "new") ||
    (segments.length === 5 && segments[4] === "history")
  );
}

/** Section roots (and sub-views) whose rule lives in guardDestination. */
function checkedByDestination(path: string, feature: string | undefined) {
  return (
    isSectionPath(path.split("/").filter(Boolean), feature) &&
    (feature === "assets" || (feature !== undefined && feature in OWNER_GATED))
  );
}

/**
 * Destinations whose rule may depend on ownership. Ownership is fetched only
 * when the access flags alone do not already open the destination.
 */
async function guardDestination(
  path: string,
  access: components["schemas"]["AppAccessResponse"],
  loadOwned: (estateId: string) => Promise<boolean>
) {
  const segments = path.split("/").filter(Boolean);
  const [, estateId, feature] = segments;
  if (!(estateId && feature && isSectionPath(segments, feature))) {
    return;
  }
  const estate = access.estates.find((item) => item.estateId === estateId);
  if (feature === "assets") {
    if (!canOpenAssets(estate)) {
      throw notFound();
    }
    return;
  }
  const open = OWNER_GATED[feature];
  if (!open) {
    return;
  }
  const admin = access.canAccessPlatformAdmin;
  if (open(estate, false, admin)) {
    return;
  }
  if (!(estate && open(estate, await loadOwned(estateId), admin))) {
    throw notFound();
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

function guardFeaturePath(
  path: string,
  access: components["schemas"]["AppAccessResponse"]
): boolean {
  if (!path.startsWith("/estates/")) {
    return false;
  }
  const [, , estateId, feature] = path.split("/");
  const estate = access.estates.find((item) => item.estateId === estateId);
  switch (feature) {
    case "work-orders":
      guardWorkOrders(path, estate);
      return true;
    case "documents":
      guardDocuments(path, access);
      return true;
    case "readings":
      if (
        !estate?.canViewReadings ||
        (path.split("/")[4] === "new" && !estate.canRecordReadings) ||
        (path.split("/")[4] === "imports" &&
          !(
            estate.canImportReadings ||
            estate.canRevertReadingImports ||
            estate.role === "MANAGER"
          ))
      ) {
        throw notFound();
      }
      return true;
    default:
      return false;
  }
}
