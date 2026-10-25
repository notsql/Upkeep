# Access projection and retired global grants

Source of truth: packages/api/openapi.json. JWTs supply identity; current Neon
membership/ownership supplies authority. WorkOS admin claims grant no application
platform or general estate powers. Sensor management permits owners and current
same-estate MANAGER members without a provider-admin claim, while retaining its
legacy admin-plus-MEMBER/COUNCIL compatibility checks; see
[flatlined-sensors.md](flatlined-sensors.md).

GET `/access/context` takes no body and returns 200 AppAccessResponse for an
authenticated subject. Missing identity returns 401; database failure returns 503
EstateError { message: string }. Cache-Control is private, no-store.

AppAccessResponse fields: canEnterWorkspace/canCreateEstate/canAccessPlatformAdmin/
hasResidentMembership/canSubmitReport: boolean; residentEstates: { id: UUID,
name: string }[]; estates: EstateAccessResponse[]. canAccessPlatformAdmin is false.

EstateAccessResponse fields: estateId: UUID; estateName: string; role: MANAGER/MEMBER/COUNCIL/RESIDENT/
CREW/CUSTOM; canViewManagement/canManageEstate/canViewAssets/canInviteMembers/
canManageInvitationPermissions/canViewFaultReports/canRelocateFaultReports/
canViewWorkOrders/canCreateWorkOrders/canUpdateWorkOrders: boolean. Owners project as MANAGER; ownership is
separate. Managers manage estate-local invitations/roles; inactive estates cannot
receive new invitations. MEMBER/COUNCIL retain dashboard reads. RESIDENT/CREW gain
no management access. Asset visibility and other management mutations retain
existing individual service guards; broader operations remain separate features.

Every authenticated subject has `canCreateEstate=true`, regardless of existing
membership or WorkOS role claims. Creation records the authenticated subject's
ownership and MANAGER membership atomically in the new estate. Other assignments
are preserved. `canEnterWorkspace` requires an existing management, report, work-order, role-authoring or estate-invitation capability. An unassigned response has `canCreateEstate=true`,
all other booleans false and both collections empty. Account migration remains deferred.
Migration `20261022135000_backfill_estate_owner_memberships` specifically repairs
existing estate owners: insert a missing MANAGER membership or normalize an
owner's MEMBER/COUNCIL/CREW row to MANAGER. Existing MANAGER rows, membership
timestamps/delegation flags, other users and other-estate assignments are preserved.
Owner/RESIDENT conflicts remain RESIDENT and fail closed. This makes existing
owners' report capabilities match newly created estates without changing the
membership-based report authorization rule.

Legacy `/api/admin/users/**` and `/users/**` routes are denied by SecurityConfig,
including provider admins and local development. Legacy contracts remain in
OpenAPI for compatibility, not authorization. EstateUserService also rejects old
global list/add/remove operations. Use [estate member/invitation APIs](council-invitations.md).

residentEstates contains active RESIDENT assignments. Reporting explicitly selects
and validates one estate; missing membership never promotes an account. Historical
report reads remain submitter-only after revocation. Unknown business methods and
routes remain denied by the final SecurityConfig rule.

`canViewFaultReports` requires current MANAGER/CREW membership or custom VIEW_FAULT_REPORTS, including inactive
estate history. `canRelocateFaultReports` additionally requires an active estate and, for CUSTOM, RELOCATE_FAULT_REPORTS.
CUSTOM projects the corresponding current permission independently; other non-responder presets project both false; owner/Resident conflicts remain false. Crew
report access sets `canEnterWorkspace=true` while `canViewManagement` and other
management capabilities remain false. `estateName` labels report estate choices
without requiring Crew to call management estate endpoints. See [estate-reports.md](estate-reports.md).

`canManageEstate` grants detail editing to the current owner or MANAGER in that
estate or custom EDIT_ESTATE, including inactive estates. Council/Member/Crew/Resident/unassigned users
cannot edit; Manager authority in another estate is insufficient. Deactivation
and ownership transfer independently require current ownership. Transfer keeps
the former owner's MANAGER membership and editing capability. See [estates.md](estates.md).

Spring Security explicitly admits the following existing operations for authenticated callers; the estate services still enforce owner-only access through `EstateRepository.findOwned`:

| Method | Path | Access |
| --- | --- | --- |
| GET | `/asset-categories` | Any authenticated user |
| GET | `/manufacturers` | Any authenticated user |
| GET | `/manufacturers/{manufacturerId}/models` | Any authenticated user |
| GET / POST | `/estates/{estateId}/assets/{assetId}/events` | Estate owner |
| GET | `/estates/{estateId}/assets/{assetId}/failure-risk` | Estate owner |
| GET | `/estates/{estateId}/failure-risk` | Estate owner |
| POST | `/estates/{estateId}/assets/{assetId}/readings/anomaly-check` | Estate owner |
| POST | `/estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential` | Estate owner; issue or replace a device key |
| GET | `/estates/{estateId}/devices` | Estate Manager (owner or `MANAGER` member) via `findManaged`; see [device-status.md](device-status.md) |
| GET | `/estates/{estateId}/assets/{assetId}/devices` | Estate Manager (owner or `MANAGER` member) via `findManaged` |

Catalogue lookups contain no estate data, so resident and unassigned accounts may read them. Estate operations reject a same-estate resident membership even when ownership conflicts, while residency elsewhere does not block legitimate ownership. MEMBER/COUNCIL membership and platform-admin authority alone do not grant access to these owner-only operations. The matchers are method-specific; unsupported methods and unknown nested actions remain denied by the final `denyAll()` rule. Missing or invalid authentication returns 401 when JWT authentication is configured.

Sensor GET policies/review, PUT metric policy and POST device/metric pause routes
are explicitly admitted for authenticated requests, then enforce the feature's
owner/assigned-manager write and Council read permissions. See
[flatlined-sensors.md](flatlined-sensors.md). The existing POST
`/estates/{estateId}/locations/{blockId}/floors` is also admitted; its location service enforces ownership or custom CREATE_LOCATIONS.

Work-order history uses canViewWorkOrders for current owners/Managers/Crew,
including inactive estates. canCreateWorkOrders additionally requires an active
estate and owner/Manager authority. Same-estate Resident conflicts deny both.
Crew reads every estate work order without assignment filtering. The limited
asset picker uses creation authority and does not change canViewAssets.
See [work-orders.md](work-orders.md).

canUpdateWorkOrders requires current owner/Manager authority and an active estate,
with the same Resident override as creation. Crew stay read-only. This capability
does not grant owner-only asset-register access.

The custom permission catalogue does not grant work-order access. Custom
VIEW_ESTATE, EDIT_ESTATE or VIEW_FAULT_REPORTS does not imply
canViewWorkOrders/canCreateWorkOrders; independent ownership still follows the
owner policy above.

## Custom-role capability fields

EstateAccessResponse additionally requires `customRoleId: UUID | null` and
`customRoleName: string | null`, plus boolean `canCreateLocations`,
`canCreateFloors`, `canEditLocations`, `canViewEstateRoles`, `canCreateRoles`,
`canEditRoles`, `canDeleteRoles`, `canReassignRoles`, `canViewEstateInvitations`.
Presets project null custom metadata. CUSTOM resolves persisted current grants;
unsupported codes or invalid prerequisite sets grant nothing. No JWT role claim
or cached definition supplies server authority.

`AccessService.context` computes custom-role capabilities in named locals matching
its response field before constructing EstateAccessResponse.

VIEW_ESTATE grants canViewManagement and membership in estate lists/dashboard
estate counts; EDIT_ESTATE grants canManageEstate independently of location
writes. Custom CREATE_LOCATIONS grants canCreateLocations/canCreateFloors;
EDIT_LOCATIONS grants canEditLocations. Existing preset creation/editing policies
remain: Manager/owner can create, only owner gets bulk floors/editing.
Role catalogue/list access requires Manager or CREATE_ROLES/EDIT_ROLES;
canViewEstateRoles remains true while inactive. Corresponding write flags require
activity. canDeleteRoles and canReassignRoles require active Manager authority.
INVITE_MEMBERS grants active canInviteMembers and persistent
canViewEstateInvitations, permitting read/cancel of own offers while inactive.
canManageInvitationPermissions remains Manager-only member administration.
No custom permission grants canViewAssets or owner powers. Role-only and
invitation-only accounts canEnterWorkspace without general management access.
See [estate-roles.md](estate-roles.md) for the complete permission catalogue.
