# Access projection and retired global grants

Source of truth: packages/api/openapi.json. JWTs supply identity; current Neon
membership/ownership supplies authority. WorkOS admin claims grant no application
platform or estate powers.

GET `/access/context` takes no body and returns 200 AppAccessResponse for an
authenticated subject. Missing identity returns 401; database failure returns 503
EstateError { message: string }. Cache-Control is private, no-store.

AppAccessResponse fields: canEnterWorkspace/canCreateEstate/canAccessPlatformAdmin/
hasResidentMembership/canSubmitReport: boolean; residentEstates: { id: UUID,
name: string }[]; estates: EstateAccessResponse[]. canAccessPlatformAdmin is false.

EstateAccessResponse fields: estateId: UUID; estateName: string; role: MANAGER/MEMBER/COUNCIL/RESIDENT/
CREW; canViewManagement/canManageEstate/canViewAssets/canInviteMembers/
canManageInvitationPermissions/canViewFaultReports/canRelocateFaultReports: boolean. Owners project as MANAGER; ownership is
separate. Managers manage estate-local invitations/roles; inactive estates cannot
receive new invitations. MEMBER/COUNCIL retain dashboard reads. RESIDENT/CREW gain
no management access. Asset visibility and other management mutations retain
existing individual service guards; broader operations remain separate features.

Every authenticated subject has `canCreateEstate=true`, regardless of existing
membership or WorkOS role claims. Creation records the authenticated subject's
ownership and MANAGER membership atomically in the new estate. Other assignments
are preserved. `canEnterWorkspace` still requires an existing management or
report-responder capability. An unassigned response has `canCreateEstate=true`,
all other booleans false and both collections empty. Account migration remains deferred.

Legacy `/api/admin/users/**` and `/users/**` routes are denied by SecurityConfig,
including provider admins and local development. Legacy contracts remain in
OpenAPI for compatibility, not authorization. EstateUserService also rejects old
global list/add/remove operations. Use [estate member/invitation APIs](council-invitations.md).

residentEstates contains active RESIDENT assignments. Reporting explicitly selects
and validates one estate; missing membership never promotes an account. Historical
report reads remain submitter-only after revocation. Unknown business methods and
routes remain denied by the final SecurityConfig rule.

`canViewFaultReports` requires current MANAGER/CREW membership, including inactive
estate history. `canRelocateFaultReports` additionally requires an active estate.
All other roles project both false; owner/Resident conflicts remain false. Crew
report access sets `canEnterWorkspace=true` while `canViewManagement` and other
management capabilities remain false. `estateName` labels report estate choices
without requiring Crew to call management estate endpoints. See [estate-reports.md](estate-reports.md).

`canManageEstate` grants detail editing to the current owner or MANAGER in that
estate, including inactive estates. Council/Member/Crew/Resident/unassigned users
cannot edit; Manager authority in another estate is insufficient. Deactivation
and ownership transfer independently require current ownership. Transfer keeps
the former owner's MANAGER membership and editing capability. See [estates.md](estates.md).
