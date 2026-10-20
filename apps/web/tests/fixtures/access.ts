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
  canViewManagement: false,
  canManageEstate: false,
  canViewAssets: false,
  canInviteMembers: false,
  canManageInvitationPermissions: false,
  canViewFaultReports: false,
  canRelocateFaultReports: false,
};

export const councilEstateAccess = {
  ...residentEstateAccess,
  estateId: "oak",
  estateName: "Oak Park",
  role: "COUNCIL",
  canViewManagement: true,
  canInviteMembers: true,
};

export const ownerEstateAccess = {
  estateId: "pine",
  estateName: "Pine Estate",
  role: "MANAGER",
  canViewManagement: true,
  canManageEstate: true,
  canViewAssets: true,
  canInviteMembers: true,
  canManageInvitationPermissions: true,
  canViewFaultReports: true,
  canRelocateFaultReports: true,
};

export const crewEstateAccess = {
  ...residentEstateAccess,
  estateId: "oak",
  estateName: "Oak Park",
  role: "CREW",
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
