import type { components } from "@proj/api/schema";
import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { getSessionAccess, getSessionIdentity } from "@/lib/access-server";

import { buildSignInPath } from "@/lib/auth-redirect";
import {
  canOpenAllDevices,
  canOpenAssets,
  canOpenCheckSchedules,
  canOpenContractors,
  canOpenEstateSettings,
  canOpenFaultReports,
  canOpenInspections,
  canOpenMembers,
  canOpenNotificationSettings,
  canOpenRoles,
} from "@/lib/estate-destinations";

type EstatePermission = components["schemas"]["EstateAccessResponse"];
type DestinationPredicate = (
  permission: EstatePermission | undefined
) => boolean;

// Sections (with sub-views) the sidebar gates; the guard uses the same flag
// predicates (estate-role-permissions), so ownership is never fetched here.
const DESTINATION_GATED: Record<string, DestinationPredicate> = {
  // Old Check schedules bookmarks redirect to Inspections' schedules view.
  "asset-categories": canOpenCheckSchedules,
  inspections: canOpenInspections,
  edit: canOpenEstateSettings,
  "notification-settings": canOpenNotificationSettings,
};

// Sections gated only by access flags, through the sidebar's own predicates.
const CAPABILITY_GATED: Record<
  string,
  (permission: EstatePermission | undefined) => boolean
> = {
  reports: canOpenFaultReports,
  contractors: canOpenContractors,
  roles: canOpenRoles,
  council: canOpenMembers,
};

// Sections whose sub-views (up to this many segments deeper) share the
// section's gate: /inspections/schedules/$interval is two below Inspections.
const SUB_VIEW_DEPTH: Record<string, number> = {
  "asset-categories": 1,
  inspections: 2,
};

/** Assets > All devices, which is gated like Devices and Device monitoring. */
function isAllDevicesPath(segments: string[]) {
  return (
    segments.length === 4 &&
    segments[2] === "assets" &&
    segments[3] === "devices"
  );
}

/** True for a section root (/estates/:id/:feature) or one of its sub-views. */
function isSectionPath(segments: string[], feature: string | undefined) {
  return (
    segments.length === 3 ||
    (feature !== undefined &&
      segments.length > 3 &&
      segments.length <= 3 + (SUB_VIEW_DEPTH[feature] ?? 0))
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
      throw new Error("Couldn't check your access. Try again.");
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
    guardDestination(path, access);
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
  // The asset page and its Records (formerly Inspections) sub-page are open
  // to inspection viewers.
  const context =
    segments.length === 0 ||
    (segments.length === 1 && segments[0] !== "new") ||
    (segments.length === 2 &&
      (segments[1] === "records" || segments[1] === "inspections"));
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
  // Checked in guardDestination; "devices" here is not an asset ID.
  if (isAllDevicesPath(path.split("/").filter(Boolean))) {
    return;
  }
  if (guardInspectionContext(path, estate)) {
    return;
  }
  const gate = feature ? CAPABILITY_GATED[feature] : undefined;
  if (gate) {
    if (!gate(estate)) {
      throw notFound();
    }
    return;
  }
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
    (feature === "assets" ||
      (feature !== undefined && feature in DESTINATION_GATED))
  );
}

/** Destinations gated by one access-flag predicate each, sub-views included. */
function guardDestination(
  path: string,
  access: components["schemas"]["AppAccessResponse"]
) {
  const segments = path.split("/").filter(Boolean);
  const [, estateId, feature] = segments;
  const allDevices = isAllDevicesPath(segments);
  if (
    !(estateId && feature && (allDevices || isSectionPath(segments, feature)))
  ) {
    return;
  }
  const estate = access.estates.find((item) => item.estateId === estateId);
  if (feature === "assets" && !allDevices) {
    if (!canOpenAssets(estate)) {
      throw notFound();
    }
    return;
  }
  // Inspections' schedules view changes check schedules (MANAGE_INSPECTIONS).
  const schedules = feature === "inspections" && segments[3] === "schedules";
  let open = allDevices ? canOpenAllDevices : DESTINATION_GATED[feature];
  if (schedules) {
    open = canOpenCheckSchedules;
  }
  if (open && !open(estate)) {
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
