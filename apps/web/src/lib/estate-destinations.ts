import type { components } from "@proj/api/schema";

// One predicate per estate destination, shared by the sidebar and the route
// guard so the two never disagree. `owned` comes from `EstateResponse`; the
// access projection has no owner flag.
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

function ownerOrDelegate(permission: Permission, owned?: boolean): boolean {
  return Boolean(
    permission && (owned || permission.canManageInvitationPermissions)
  );
}

export function canOpenInspections(
  permission: Permission,
  owned?: boolean
): boolean {
  return ownerOrDelegate(permission, owned);
}

export function canOpenAssets(permission: Permission): boolean {
  return Boolean(
    permission?.canViewAssets ||
      permission?.canViewAssetHistory ||
      permission?.canViewInspectionResults
  );
}

export function canOpenDevices(
  permission: Permission,
  owned?: boolean
): boolean {
  return ownerOrDelegate(permission, owned);
}

export function canOpenReadings(permission: Permission): boolean {
  return Boolean(permission?.canViewReadings);
}

export function canOpenSensors(
  permission: Permission,
  owned?: boolean,
  platformAdmin?: boolean
): boolean {
  if (!permission) {
    return false;
  }
  return Boolean(
    owned ||
      (permission.canViewManagement &&
        (permission.role === "MANAGER" ||
          permission.role === "COUNCIL" ||
          (permission.role === "MEMBER" && platformAdmin)))
  );
}

export function canOpenFailureRisk(
  permission: Permission,
  owned?: boolean
): boolean {
  return Boolean(permission && owned);
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

export function canOpenAssetCategories(
  permission: Permission,
  owned?: boolean
): boolean {
  return ownerOrDelegate(permission, owned);
}

/** Owners and Managers: the people who receive the estate's notifications. */
export function canOpenNotificationSettings(permission: Permission): boolean {
  return permission?.role === "MANAGER";
}

export function canOpenEstateSettings(
  permission: Permission,
  owned?: boolean
): boolean {
  return Boolean(permission && (owned || permission.canManageEstate));
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
