// API response fixtures for the agreed access projection, ahead of generation.
// Production code must use the regenerated OpenAPI types when implemented.
export const unassignedAccess = {
  canEnterWorkspace: false,
  canCreateEstate: true,
  canAccessPlatformAdmin: false,
  hasResidentMembership: false,
  canSubmitReport: false,
  residentEstates: [],
  estates: [],
};

export const residentEstateAccess = {
  estateId: "maple",
  estateName: "Maple Estate",
  role: "RESIDENT",
  customRoleId: null as string | null,
  customRoleName: null as string | null,
  canViewManagement: false,
  canManageEstate: false,
  canViewAssets: false,
  canViewEstateDetails: false,
  canViewInspectionResults: false,
  canCreateInspectionResults: false,
  canInviteMembers: false,
  canManageInvitationPermissions: false,
  canViewFaultReports: false,
  canRelocateFaultReports: false,
  canViewWorkOrders: false,
  canCreateWorkOrders: false,
  canUpdateWorkOrders: false,
  canCreateLocations: false,
  canCreateFloors: false,
  canEditLocations: false,
  canViewEstateRoles: false,
  canCreateRoles: false,
  canEditRoles: false,
  canDeleteRoles: false,
  canReassignRoles: false,
  canViewEstateInvitations: false,
};

export const councilEstateAccess = {
  ...residentEstateAccess,
  estateId: "oak",
  estateName: "Oak Park",
  role: "COUNCIL",
  canViewManagement: true,
  canViewEstateDetails: true,
  canInviteMembers: true,
};

export const ownerEstateAccess = {
  estateId: "pine",
  estateName: "Pine Estate",
  role: "MANAGER",
  customRoleId: null as string | null,
  customRoleName: null as string | null,
  canViewManagement: true,
  canManageEstate: true,
  canViewAssets: true,
  canViewEstateDetails: true,
  canViewInspectionResults: true,
  canCreateInspectionResults: true,
  canInviteMembers: true,
  canManageInvitationPermissions: true,
  canViewFaultReports: true,
  canRelocateFaultReports: true,
  canViewWorkOrders: true,
  canCreateWorkOrders: true,
  canUpdateWorkOrders: true,
  canCreateLocations: true,
  canCreateFloors: true,
  canEditLocations: true,
  canViewEstateRoles: true,
  canCreateRoles: true,
  canEditRoles: true,
  canDeleteRoles: true,
  canReassignRoles: true,
  canViewEstateInvitations: true,
};

export const crewEstateAccess = {
  ...residentEstateAccess,
  estateId: "oak",
  estateName: "Oak Park",
  role: "CREW",
  canViewEstateDetails: true,
  canViewInspectionResults: true,
  canCreateInspectionResults: true,
  canCreateWorkOrders: false,
  canViewWorkOrders: true,
  canViewFaultReports: true,
  canRelocateFaultReports: true,
};

export const residentAccess = {
  ...unassignedAccess,
  hasResidentMembership: true,
  canSubmitReport: true,
  residentEstates: [{ id: "maple", name: "Maple Estate" }],
  estates: [residentEstateAccess],
};

export const workspaceAccess = {
  ...unassignedAccess,
  canEnterWorkspace: true,
  canCreateEstate: true,
  estates: [ownerEstateAccess, councilEstateAccess],
};

export const mixedAccess = {
  ...residentAccess,
  canEnterWorkspace: true,
  canCreateEstate: true,
  estates: [residentEstateAccess, councilEstateAccess, ownerEstateAccess],
};
