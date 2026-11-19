import type { components } from "@proj/api/schema";

// One predicate per estate destination, shared by the sidebar and the route
// guard so the two never disagree. Every predicate reads the access flags,
// which the server derives from the user's permission codes
// (estate-role-permissions); ownership alone opens nothing here.
type Permission = components["schemas"]["EstateAccessResponse"] | undefined;

export function canOpenOverview(permission: Permission): boolean {
  return Boolean(
    permission?.canViewEstateDetails ?? permission?.canViewManagement
  );
}

export function canOpenWorkOrders(permission: Permission): boolean {
  return Boolean(permission?.canViewWorkOrders);
}

export function canOpenFaultReports(permission: Permission): boolean {
  return Boolean(permission?.canViewFaultReports);
}

// ID-70: contractors are managed by whoever can create work orders.
export function canOpenContractors(permission: Permission): boolean {
  return Boolean(permission?.canCreateWorkOrders);
}

/** Inspections: results, the due list and inspectors (VIEW_INSPECTIONS). */
export function canOpenInspections(permission: Permission): boolean {
  return Boolean(permission?.canViewInspectionResults);
}

/** Check schedules: service intervals and silent-failure flags (MANAGE_INSPECTIONS). */
export function canOpenCheckSchedules(permission: Permission): boolean {
  return Boolean(permission?.canManageInspections);
}

export function canOpenAssets(permission: Permission): boolean {
  return Boolean(
    permission?.canViewAssets ||
      permission?.canViewAssetHistory ||
      permission?.canViewInspectionResults
  );
}

export function canOpenDevices(permission: Permission): boolean {
  return Boolean(permission?.canViewDevices);
}

export function canOpenReadings(permission: Permission): boolean {
  return Boolean(permission?.canViewReadings);
}

/** Device monitoring: anyone who can view devices (VIEW_DEVICES; estate-role-permissions). */
export function canOpenSensors(permission: Permission): boolean {
  return Boolean(permission?.canViewDevices);
}

/** Assets > All devices: everyone who could open Devices or Device monitoring. */
export function canOpenAllDevices(permission: Permission): boolean {
  return canOpenDevices(permission) || canOpenSensors(permission);
}

/**
 * Where the sidebar's Assets entry lands: By location for asset readers,
 * else All devices for the Devices / Device monitoring audience it replaced.
 */
export function assetsEntry(
  permission: Permission
):
  | "/estates/$estateId/assets"
  | "/estates/$estateId/assets/devices"
  | undefined {
  if (canOpenAssets(permission)) {
    return "/estates/$estateId/assets";
  }
  if (canOpenAllDevices(permission)) {
    return "/estates/$estateId/assets/devices";
  }
  return undefined;
}

/** The "All readings" link on the Assets views, so it needs both. */
export function canOpenAllReadings(permission: Permission): boolean {
  return canOpenReadings(permission) && Boolean(permission?.canViewAssets);
}

export function canOpenFailureRisk(permission: Permission): boolean {
  return Boolean(permission?.canViewAssets);
}

export function canOpenDocuments(permission: Permission): boolean {
  return Boolean(permission?.canViewDocuments);
}

export function canOpenMembers(permission: Permission): boolean {
  return Boolean(
    permission?.canViewEstateInvitations ||
      permission?.canInviteMembers ||
      permission?.canManageInvitationPermissions
  );
}

export function canOpenRoles(permission: Permission): boolean {
  return Boolean(permission?.canViewEstateRoles);
}

/** Owners and Managers: the people who receive the estate's notifications. */
export function canOpenNotificationSettings(permission: Permission): boolean {
  return permission?.role === "MANAGER";
}

export function canOpenEstateSettings(permission: Permission): boolean {
  return Boolean(permission?.canManageEstate);
}

export type EstateFeature =
  | "work-orders"
  | "reports"
  | "documents"
  | "readings"
  | "report-creation"
  | "resident"
  | "management";

// Where choosing an estate lands, for the switcher and the signed-in `/`.
export function estateDestination(
  estate: NonNullable<Permission>,
  feature: EstateFeature
) {
  if (estate.role === "RESIDENT") {
    return feature === "report-creation" ? "/reports/new" : "/reports";
  }
  if (feature === "documents" && estate.canViewDocuments) {
    return "/estates/$estateId/documents";
  }
  if (feature === "readings" && estate.canViewReadings) {
    return "/estates/$estateId/readings";
  }
  if (feature === "reports" && estate.canViewFaultReports) {
    return "/estates/$estateId/reports";
  }
  if (feature === "work-orders" && estate.canViewWorkOrders) {
    return "/estates/$estateId/work-orders";
  }
  if (estate.canViewEstateDetails ?? estate.canViewManagement) {
    return "/estates/$estateId";
  }
  if (estate.canViewWorkOrders) {
    return "/estates/$estateId/work-orders";
  }
  if (estate.canViewFaultReports) {
    return "/estates/$estateId/reports";
  }
  if (estate.canViewDocuments) {
    return "/estates/$estateId/documents";
  }
  if (estate.canViewEstateRoles) {
    return "/estates/$estateId/roles";
  }
  if (estate.canViewEstateInvitations) {
    return "/estates/$estateId/council";
  }
  return "/estates";
}
