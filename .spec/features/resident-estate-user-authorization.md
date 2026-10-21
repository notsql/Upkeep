# Pivot resident reporting authorization to EstateUser

**Status:** implemented on 2026-10-13; workspace tests, types and dev migrations verified; jOOQ regeneration pending
**Owner:** unassigned
**Related feature:** [Resident fault reporting](resident-fault-reporting.md)

**Planned policy revision (2026-10-18):** the
[estate roles and invitations draft](estate-role-invitations.md) supersedes this
implementation's one-resident-estate limit, manual-only provisioning and earlier
role/delegation boundaries. Residents may be assigned to multiple estates;
Managers/Admins invite and manage estate members, Council manages assets, and
Managers/Crew manage estate-wide reports. Those changes are not built yet. The
sections below retain the 2026-10-13 implementation baseline; own-history reads,
estate-local authorization and identity-based report ownership still apply.

## Problem

The resident implementation currently uses the WorkOS `resident` JWT claim to
restrict API access and select the reporting interface. A separate
`ResidentAssignment` table supplies the estate. This requires coordinating two
role/assignment sources, and changing the database assignment does not change
the role in an existing WorkOS session.

The pivot makes `EstateUser.role = 'RESIDENT'` the resident authority. WorkOS
continues to authenticate the user and supply a verified subject. Existing
WorkOS authorization for platform administration remains a separate concern;
this plan does not move platform admins into an estate membership.

This is a proposed replacement for the authorization and assignment portions
of the original feature. Its report content, locations, image validation, R2
storage, ownership checks and pagination continue to apply.

## Agreed direction and proposed scope

**Agreed on 2026-10-13:** allow different access in each estate. A user can be a
resident in Estate A and a council member or owner in Estate B. Resident access
in A does not remove their approved management permissions in B; management
access in B does not grant management access in A.

Authorization therefore resolves the caller's capabilities for the estate being
requested. Navigation can show both reporting and management destinations.
There is no single mutually exclusive resident/workspace account mode.

**Also agreed on 2026-10-13:** a new unassigned resident has no permissions for
any estate. Assignment as RESIDENT grants report creation for that estate only;
it grants no management permissions. Authentication alone grants neither estate
access nor report creation. Until a trusted role/ownership record exists, the
application shows an awaiting-assignment state without estate data.

**Also agreed on 2026-10-13:** revocation deletes the corresponding `EstateUser`
row. Do not add `revokedAt` or retain revoked membership records. Submitted
reports and images remain intact, and access to them uses submitter ownership.
Deleting the row in A does not affect the user's memberships or ownership in B.

| Same user's relationship | Result |
| --- | --- |
| RESIDENT in Estate A | Submit faults in A and read their own reports; no A management data. |
| COUNCIL in Estate B | Retain existing B council/member access and any approved invitation delegation. |
| Owner of Estate C | Retain existing C owner permissions, including owner-only asset features. |

Use the existing `EstateUser` role column with the explicit value `RESIDENT`.
Keep `MEMBER` and `COUNCIL` as their existing management membership roles.
Ownership stays on `Estate.ownerUserId`. Do not reinterpret every `MEMBER` as
a resident or introduce an `OWNER` membership role in this feature.

Consolidate the resident estate assignment into `EstateUser`. Delete the row
when removing membership, stopping its permissions immediately.
Historical report access remains based on submitter identity. Remove
`ResidentAssignment` only after the new source has been verified and cut over.
The proposal retains the original limit of one current resident estate per
user; management memberships in other estates do not count against that limit.

## Behaviour

- A valid WorkOS token proves identity. A `resident` claim without an
  `EstateUser` resident row grants no resident capabilities. An `EstateUser`
  resident row works with an ordinary WorkOS user token; changing JWT role
  claims does not change resident permissions.
- Spring resolves resident access from the database on every request. Role
  changes and revocation take effect with the same token, without signing out
  or refreshing the WorkOS session.
- At most one `RESIDENT` membership exists per user. Only an existing resident
  membership in an active estate permits new submissions.
- A new unassigned resident receives no estate capabilities and cannot submit
  reports. Assigning them to A enables submission in A only; submitting a
  location in B remains denied. The reporting screen explains when no active
  assignment exists.
- Deleting a resident membership or deactivating its estate blocks new
  submissions for that estate. Own-report history remains readable. After
  deletion, an account with no other grants receives the same awaiting-assignment
  state as an account that was never assigned.
- A resident in Estate A and a current MEMBER/COUNCIL or owner in Estate B can
  open only the management features their existing B permissions permit.
  Neither membership transfers capabilities to the other estate.
- Management requests targeting the caller's resident estate receive 403.
  Requests targeting an unrelated inaccessible estate retain the existing 404
  behavior. Resolve the estate from the actual resource for endpoints that
  identify only an asset/device/location; a supplied estate ID cannot bypass it.
- Account endpoints such as the dashboard and estate directory return only
  estates where the caller has management access. A resident-only account
  cannot use them to obtain management information about its assigned estate.
- Platform-admin endpoints retain their existing admin authorization. A
  resident membership in another estate does not remove platform admin access;
  that admin claim does not by itself grant ordinary estate-management access.
- Management estate reads accept ownership or a current `MEMBER`/`COUNCIL`
  membership. A resident row alone never grants estate, asset, device, council
  or management-dashboard information for that estate. Resident rows never
  authorize council invitations. The same caller may invite in another estate
  if that estate's existing ownership/delegation checks authorize it.
- Report submitter identity and estate are still derived by Spring. The client
  cannot nominate its role, submitter or estate. Recheck and lock the current
  resident membership and estate inside the report write transaction after
  image upload; revoked or changed membership aborts creation and cleans up
  staged images.
- Historical list, detail and image reads use authenticated subject and report
  ownership. They do not require a current estate membership. Another user's
  report or image remains indistinguishable from a missing one (404).
- Frontend route entry, navigation and report-query gates use Spring's access
  projection. They do not inspect `useAuth().role` for resident behavior.
- While access is loading or unavailable, no management screen or management
  query mounts. A failed database lookup denies access; it never falls back to
  a JWT role or a guessed workspace mode.
- Manual seeding remains the provisioning path for the two acceptance
  residents. No resident assignment editor is introduced by this pivot.
- Changing a role within the same estate is an explicit trusted operation.
  Council invitations and generic membership grants cannot silently convert
  that estate's resident row. A RESIDENT row that conflicts with ownership in
  the same estate must be corrected before cutover; until corrected, fail
  closed for management access in that estate, without blocking other estates.

## Data

| Model | Proposed change |
| --- | --- |
| `EstateUser` | Keep `(estateId, userId)` as the primary key. Use `role = RESIDENT` for reporting membership. Delete the row on membership revocation. No revocation column is added. Resident rows must have `canInviteMembers = false`. |
| `ResidentAssignment` | Backfill only reviewed rows with `revokedAt IS NULL` into `EstateUser`, preserving estate and creation time. Previously revoked assignments produce no membership row. Stop reading/writing this table at cutover, then remove it in a subsequent migration. |
| `IssueReport`, `IssueReportImage` | Preserve existing IDs, submitter, estate, location and image metadata. No report relation to the current membership: membership changes must not destroy history. |

Prisma owns both schema migrations and any SQL constraints in their migration
directories. Use a partial unique index on `EstateUser.userId` where
`role = 'RESIDENT'`. Estate deactivation blocks submission
but does not free that membership slot; a move explicitly deletes the old row.
Add a check preventing `RESIDENT` rows with invitation delegation. Audit existing
role values before adding a check for the supported role values.

Every existing management membership lookup must require an existing row with
an accepted management role; unknown role strings never count as a grant.
Changing only the reporting repository would leave a confidentiality gap.

Moving a resident deletes their old resident row and creates the destination
resident row in one transaction. Other estate memberships are untouched. If a
destination already has a `MEMBER`/`COUNCIL` grant, stop for an explicit role
conversion decision rather than overwriting it.

## Access projection and API

Add a small authenticated endpoint that any signed-in user can call before the
application knows their estate role. It must be reachable without satisfying
the resident policy, preventing a circular role lookup.

Proposed `AppAccessResponse` uses independent capabilities:

- `canEnterWorkspace: boolean`: at least one estate management grant/ownership,
  or existing platform-admin access. This controls navigation and account-level
  management pages; it never authorizes a particular estate.
- `canCreateEstate: boolean`: true for every authenticated subject under
  [self-service creation](self-service-estate-creation.md) (2026-10-20), including
  unassigned and Resident-only accounts. Creation establishes authority only in
  the new estate.
- `canAccessPlatformAdmin: boolean`: existing platform-admin authorization.
- `hasResidentMembership: boolean`: an existing RESIDENT row, including one in
  an inactive estate. False after that row is deleted.
- `canSubmitReport: boolean`.
- `residentEstate: { id: UUID, name: string } | null`: current active resident
  estate label only.
- `estates: EstateAccessResponse[]`: caller-scoped capability projections, with
  no addresses, asset data or other residents' identities.

`EstateAccessResponse` contains `estateId: UUID`,
`role: OWNER | MEMBER | COUNCIL | RESIDENT` (OWNER is derived from the existing
owner column), `canViewManagement: boolean`, `canManageEstate: boolean`,
`canViewAssets: boolean`, `canInviteMembers: boolean`, and
`canManageInvitationPermissions: boolean`. Compute these flags using existing
feature permissions: this pivot does not make council members asset owners.
Deleted memberships confer no capabilities. An inactive estate
blocks resident submission and management operations that already require an
active estate; preserve existing owner/history reads and other inactivity rules.
Existing resident rows identify restricted management deep links. After
deletion, the estate follows the normal inaccessible-estate behavior.
Same-estate ownership/RESIDENT conflicts are reported as
403 for management actions until corrected.

An account with no memberships, ownership or platform-admin access receives
false estate-management and report-submission capabilities. Its projection has
`estates = []`, `residentEstate = null`, `canSubmitReport = false`,
`canEnterWorkspace = false` and `canCreateEstate = true`. It can authenticate,
create its first estate, sign out and read reports it previously submitted, but
receives no existing-estate data without an assignment. A new unassigned resident has no previous
reports. Existing accounts with an authorized management role in another estate
continue to use that estate's permissions.

| Method | Path | Request | Success | Authorization / errors |
| --- | --- | --- | --- | --- |
| GET | `/access/context` | None | 200 `AppAccessResponse` | Any authenticated subject; 401 invalid session, 503 access lookup unavailable. Private, no-store. |
| GET | `/resident/context` | None | 200 existing `ResidentContextResponse` | Authenticated subject. `estate = null`, `canSubmit = false` without a current active resident estate; 401, 503. |
| GET | `/resident/locations` | None | 200 existing location array | Existing resident membership; an inactive estate gives an empty array. No membership gives 403; also 401/503. Only the current active estate supplies locations. |
| POST | `/resident/reports` | Existing multipart description, location and images | 201 existing report detail + Location | Existing resident membership in an active estate; existing 400/401/403/413/415/503 cases. |
| GET | `/resident/reports` | Existing cursor and limit | 200 own-report page | Authenticated subject, filtered by ownership regardless of current role; 400 invalid pagination, 401. |
| GET | `/resident/reports/{reportId}` | UUID path | 200 existing report detail | Authenticated subject and ownership; 401, 404. |
| GET | `/resident/reports/{reportId}/images/{imageId}` | UUID paths | 200 existing private image bytes | Authenticated subject and ownership; 401, 404, 503. |

The history policy intentionally allows a user whose estate role later changes
to continue reading reports they submitted. It gives no access to anyone else's
records, including when the caller owns the report's estate. Estate capabilities
control management access and new submission; submitter ownership controls
the resident history endpoints.

Example: subject `user_a` has RESIDENT in A and COUNCIL in B. Its access response
permits reporting in A and the existing council capabilities in B. Revoking A
changes `canSubmitReport` to false with the same JWT; B's capabilities remain.

Use Java records and OpenAPI annotations, regenerate the contract with
`pnpm api:generate`, and consume only the generated frontend types. No
client-supplied user ID is accepted by either context endpoint.

The existing admin membership API also needs a small, explicit contract change:

| Method | Path | Change | Authorization / errors |
| --- | --- | --- | --- |
| GET | `/api/admin/users/{userId}/estates` | Extend each `EstateUserResponse` with `membershipRole: MEMBER \| COUNCIL \| RESIDENT \| null` and `canManageGrant: boolean`. `granted` describes a management grant, not a resident assignment. Deleted rows have no membership role. | Existing platform-admin check; 200/401/403. |
| PUT / DELETE | `/api/admin/users/{userId}/estates/{estateId}` | Preserve normal management-grant behavior, including grants in other estates for a resident. Reject changes to the target estate's resident row with 409. | Existing admin authorization and existing errors, plus 409 for a resident assignment/conflict in the target estate. |

Resident rows remain read-only in this UI; manual provisioning performs resident
assignment, revocation and moves. This does not add an assignment management API.

## Backend changes to review

1. Introduce one small database-backed access resolver used by Spring's request
   authorization and the context/report services. Resolve capabilities by
   `(JWT subject, target estate)`. Return a per-request result; do not cache the
   role in the JWT or an application-wide user cache.
2. Replace `.hasRole("resident")` and the `ROLE_resident` exclusion in
   `SecurityConfig`. Keep JWT verification, public infrastructure, CORS and
   platform-admin authorization. Inventory business routes and associate each
   with the appropriate estate or account capability; deny unknown actions,
   including unknown `/resident/**` routes. Do not implement a global
   "has resident membership" denial or treat management access somewhere as
   permission everywhere. Estate services enforce the target-estate policy,
   including owner-only paths that currently bypass general membership reads.
3. Replace `ResidentReportRepository.activeAssignment` with an active
   `EstateUser` resident lookup and transaction locking. Use regenerated jOOQ
   tables for the changed schema.
4. Audit `EstateRepository.accessibleTo` and response capabilities,
   `DashboardRepository` estate/member aggregates, `CouncilRepository` member
   lists, delegation, inviter validation and invitation activation. Add explicit
   management-role predicates and exclude resident rows for the estate
   being queried. Audit owner checks in asset/device/location services as well.
   Filter account-level collections by these same predicates. Preserve existing
   MEMBER/COUNCIL behavior and existing delegation-revocation rules; this pivot
   does not grant council users features that currently require ownership.
5. Protect `EstateUserRepository`/service mutations: generic grant creation or
   council invitation acceptance cannot silently replace an existing resident
   role with a management grant in the same estate. Grants and council invitations
   in a different estate follow the existing authorization flow. Generic grant
   endpoints return 409 for edits to the target resident row.
   Trusted manual resident removal deletes the EstateUser row. Use the admin
   projection above to distinguish reporting assignments and disable incompatible
   grant controls in `MemberEstates`.
6. Resident provisioning and access make no WorkOS role-management calls. Keep
   the previously requested single-WorkOS-role rule in the existing admin flow
   unless it is explicitly rescinded, but make resident authorization independent
   of it. Replace tests requiring a WorkOS resident role with database-authority
   tests; retain unrelated admin role-management tests.

## Frontend changes to review

- Add the generated-client access hook in `apps/web/src/lib/access.ts`, keyed
  `[userId, "app-access"]`, gated on mounted, resolved identity and token
  readiness. Clear access/report caches and image URLs on identity change.
- Move protected route authorization into an awaited `beforeLoad` boundary so
  child loaders cannot start management requests while a parent loader is still
  resolving access. The Home entry uses the same policy. Use an error/pending
  screen for an unresolved lookup instead of rendering workspace content.
- During SSR, a server-only access helper may call Spring with a fresh generated
  client and that request's AuthKit token. Return only the access DTO to the
  route. Do not set the shared browser API resolver during SSR, serialize bearer
  tokens, or access the database from web. Business requests in the browser
  continue to call Spring directly.
- Remove resident checks against `auth.role` from `_auth/route.tsx`,
  `routes/index.tsx`, `home-page.tsx`, `app-navigation.tsx` and `lib/reports.ts`.
  Navigation waits for the access result. Show Report a fault/My reports and
  management destinations together when both capabilities exist. Estate
  switching lists only management-accessible estates; the reporting form uses
  its separate resident estate label. It must not render A's management shell
  just because the caller can manage B.
- For users with only resident access, the default sign-in landing remains
  `/reports/new`. For mixed users, retain an authorized management return URL
  and use Home as the default workspace landing, with reporting links available.
  A management deep link to their resident estate redirects to reporting;
  a deep link to a permitted management estate renders its permitted screen.
  An unrelated inaccessible estate retains the not-found/access-denied behavior.
- Residents whose membership was deleted see the missing-assignment explanation
  and can open My reports; removal in A does not remove B's management navigation.
  Keep My reports available to authenticated users independently of
  `hasResidentMembership`, so deletion does not hide the history entry point.
  A management deep link to A after removal follows the inaccessible-estate
  behavior; the application does not infer a current role from old reports.
  Own-report history remains available after an approved role conversion. Estate
  detail routes check target-estate capabilities, not just `canEnterWorkspace`.
- Refetch access on route entry and window focus; invalidate affected access,
  estate and report-context queries after local membership changes. Spring's
  per-request checks remain authoritative if a remote role change precedes the
  browser refetch. Treat a 403 caused by changed membership as an access refresh,
  rather than displaying cached management content.

## Migration and cutover

1. Inventory `ResidentAssignment` rows, existing resident WorkOS accounts,
   `EstateUser` roles and estate ownership. Report conflicts: multiple current
   resident estates, different roles for the same estate/user pair, ownership
   and RESIDENT in the same estate, resident delegation flags, and WorkOS-only
   residents without any assignable estate row. Management memberships or
   ownership in other estates are valid and must be preserved. Resolve actual
   conflicts explicitly; do not infer a role from `MEMBER` or report history.
2. Add an **expand** migration for the reviewed resident constraints; no
   revocation column is needed. Backfill only unrevoked resident assignments,
   preserving original creation timestamps. Already revoked assignments produce
   no EstateUser row. Preserve their report records and images.
   Seed the two test residents as `EstateUser` residents. Validate source and
   target counts and all conflicts before cutover.
3. Deploy the API and web changes together or with an explicitly compatible
   access-contract sequence. At cutover, authorization reads `EstateUser` only;
   there is no JWT-role fallback and no dual-write role authority. Keep the old
   assignment table for a short verified rollback window without new writes.
4. Verify sign-in/deep links with ordinary WorkOS user roles, direct API denial,
   same-token revocation and historical report/image access. Check management
   regressions with MEMBER, COUNCIL, owner and platform-admin accounts, including
   a mixed resident-in-A/manager-in-B account.
5. Add a **contract** migration removing `ResidentAssignment` after verification.
   Do not edit the already applied `20261012122402_resident_fault_reporting`
   migration. Regenerate Prisma and jOOQ sources after each schema change.

The jOOQ regeneration attempt remains blocked by the uncached 3.21.7 Maven codegen
plugin. Prisma regeneration completed and both migrations are applied to Neon dev; AGENTS.md forbids
agents from installing packages or Maven tools. No new dependency is expected
for the pivot itself.

## Tests first and acceptance

Write and observe new failing tests for the new authority before changing code.
Revise old WorkOS-resident tests explicitly as a specification change; retain
their confidentiality assertions with database resident fixtures.

- Database resident + ordinary JWT role can submit; JWT resident + no database
  role cannot. Tampered/elevated JWT roles do not override a database resident.
- One JWT can report in A and use its approved management permissions in B.
  A's management endpoints remain denied despite B's ownership/council role.
  Tampered target IDs cannot expose A through B's authorized route parameters.
- Management collections/dashboard omit resident-only estates. Unknown actions
  are denied. Platform admin checks remain independent of membership elsewhere;
  a non-admin cannot use a council role to reach admin endpoints.
- Same-estate RESIDENT/owner conflicts and resident delegation flags cannot
  create management privileges; conflicts do not block legitimate access in B.
- Role change/revocation with the same JWT immediately changes permissions.
  Delete the membership row in the fixture to exercise revocation. Deletion/move
  during upload prevents commit and preserves cleanup behavior.
- Missing/inactive resident membership blocks submission. Revoked/moved users
  retain own-report history. Another resident in the same estate or a different
  estate receives the same 404 for private detail/images.
- An unassigned account has no estate capabilities or report creation access.
  Manual assignment to A enables creation only in A without changing its JWT.
- Deleting the last resident membership leaves no role marker and blocks new
  submissions. Own-report list/detail/images and the My reports link remain
  available; an independent management membership in B still works. A revoked
  legacy ResidentAssignment is not backfilled into an EstateUser grant.
- The database rejects two current resident estates and resident delegation.
  Backfill conflicts do not overwrite existing grants or report records.
- MEMBER/COUNCIL/owner management reads and council invitation flows still work
  in B for a resident of A. Council acceptance in B cannot replace A's role;
  acceptance targeting an existing resident row in the same estate is rejected.
  Resident rows cannot enter management lists, aggregates or invitation grants.
- Access lookup loading/error and the proposed unprovisioned state never mount
  management screens. A mixed account gets both navigation sets, an authorized
  B deep link and a redirected A deep link. Navigation, Home and report hooks
  ignore WorkOS's resident claim. Cross-user caches and blob URLs stay isolated.
- The two manually provisioned resident accounts complete the journey while
  holding ordinary WorkOS user roles. A non-resident regression account retains
  its approved access. Verify actual test execution, not just cached summaries.

## Implementation phases

- [x] Resolve mixed estate roles, unassigned access and membership deletion.
- [x] Update the original resident feature spec to match this pivot and add an
  ADR superseding the role/assignment portions of decision 0026. Keep the
  existing decision as history.
- [x] Write and run failing role-authority, confidentiality and migration tests.
- [ ] Apply the expand migration, reviewed backfill and generated Prisma/jOOQ
  sources; observe database constraints and acceptance fixtures.
- [x] Implement the database access policy and membership-query changes, then
  report creation/history permissions; run server tests.
- [x] Export the access contract and update frontend guards, navigation and
  session/query gates against failing frontend tests.
- [ ] Verify the two-resident and management regression journeys, then remove
  the legacy assignment table with the contract migration.
- [ ] Run `pnpm check-types`, `pnpm test`, `pnpm fix` and relevant builds; update
  `.docs/api/resident-reports.md`, `.docs/frontend/resident-reports.md`, auth,
  shell, affected membership docs and their index. Add API documentation for
  `/access/context`. Mark built only after verification.

## Out of scope

- Moving platform-admin authorization or authentication away from WorkOS.
- Resident onboarding or assignment management screens/endpoints.
- Expanding MEMBER/COUNCIL permissions beyond their existing capabilities.
- Multiple simultaneous resident estates; this would require a separate report
  estate selector/API contract decision.
- Changes to report content, image limits/storage, pagination, staff triage,
  status editing or notifications.
- Automatic conversion of MEMBER/COUNCIL accounts into residents.

## Decision status

All three policy questions are resolved: access is per estate, unassigned
residents have no estate permissions, and revocation deletes the membership row.
This document records the implementation plan; code changes and migrations are
the next task.

## Verification on 2026-10-13

The workspace test run executed 228 web tests, 251 Java tests and the ML suite successfully. Type checks and `pnpm fix` pass; the web build and `pnpm api:generate` pass. The expand/backfill and contract migrations pass disposable-Postgres tests and `pnpm db:migrate` applied both to Neon dev. Prisma client generation completed.

`pnpm db:generate` could not regenerate jOOQ: `org.jooq:jooq-codegen-maven:3.21.7` is not cached. Maven was run offline under AGENTS.md's no-install rule. A human must cache the generator (or run `MAVEN_ARGS= pnpm db:generate`) before the generated Java database source step can be completed. No generated Java files were edited by hand. Live WorkOS sign-in acceptance remains a separate rollout check; local tests cover two resident fixtures and management regressions.
