// API response fixtures for the agreed access projection, ahead of generation.
// Production code must use the regenerated OpenAPI types when implemented.
export const unassignedAccess = {
  canEnterWorkspace: false,
  canCreateEstate: false,
  canAccessPlatformAdmin: false,
  hasResidentMembership: false,
  canSubmitReport: false,
  residentEstate: null,
  estates: [],
};

export const residentEstateAccess = {
  estateId: "maple",
  role: "RESIDENT",
  canViewManagement: false,
  canManageEstate: false,
  canViewAssets: false,
  canInviteMembers: false,
  canManageInvitationPermissions: false,
};

export const councilEstateAccess = {
  ...residentEstateAccess,
  estateId: "oak",
  role: "COUNCIL",
  canViewManagement: true,
  canInviteMembers: true,
};

export const ownerEstateAccess = {
  estateId: "pine",
  role: "OWNER",
  canViewManagement: true,
  canManageEstate: true,
  canViewAssets: true,
  canInviteMembers: true,
  canManageInvitationPermissions: true,
};

export const residentAccess = {
  ...unassignedAccess,
  hasResidentMembership: true,
  canSubmitReport: true,
  residentEstate: { id: "maple", name: "Maple Estate" },
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
