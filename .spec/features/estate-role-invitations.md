# Estate roles, invitations and ownership

**Status:** invitation/member/ownership implementation verified on 2026-10-18.

2026-10-22 owner compatibility fix: apply migration
`20261022135000_backfill_estate_owner_memberships` to align existing owners with
new-estate MANAGER membership. Missing owner memberships are added and legacy
nonresident owner roles are normalized; Resident conflicts and unrelated
memberships remain unchanged. Report permissions continue to use current
MANAGER/CREW membership.
Account migration is deferred; staff report-location editing and broader
asset/report operations are separate features.
**Owner:** unassigned
**Related features:** [Existing invitations](manager-account-authorization.md),
[resident authorization](resident-estate-user-authorization.md),
[Neon role management](neon-role-management.md),
[fault report locations](fault-report-locations.md)

## Problem

The current invitation form accepts only an email and acceptance inserts COUNCIL.
It cannot invite residents, managers or crew with their intended permissions.
Current owner-only writes, delegated council invitations, single-estate resident
assignment and WorkOS admin checks also disagree with the revised role policy.
Changing the selector alone would leave authorization and onboarding inconsistent.

## Confirmed role policy

The user's detailed policy on 2026-10-18 supersedes the earlier draft's
owner-only invitations/member administration, delegated inviters, read-only
Council assets, Council report-responder access and one-resident-estate limit.
The user also confirmed **Manager and Admin are the same role**. Use MANAGER as
the canonical planned value and Admin as its alias; do not introduce a separate
platform-admin role or give a manager access to unassigned estates.

Ownership is the relationship `Estate.ownerUserId`, assigned to the manager who
creates the estate. It is not a fifth role or an invitation option. An owner has
the same operational permissions as a manager, plus ownership-specific powers.
Every estate must retain at least one owner. The current single-owner model
remains: removing or demoting that owner requires transferring ownership first.
The recipient must already hold MANAGER membership in the same estate; transfer
never creates a membership or implicitly changes a Council, Resident or Crew role.

Existing-account migration is deferred at the user's request. The earlier
roleless-account Manager designation is not an active implementation requirement.
Do not inventory, import or automatically reclassify existing accounts in this
work. This deferral does not remove schema changes required for invitation roles.

| Role / relationship | Confirmed permissions |
| --- | --- |
| Estate owner | The creating manager owns the estate. Only its current owner may delete it or transfer ownership to another manager/admin. Transfer immediately removes the former owner's deletion right. Estate deletion implementation is out of scope. |
| Manager (Admin), `MANAGER` | Create estates; read and update created/assigned estates; CRUD access to the estate management dashboard, estate assets, role management dashboard, estate roles/permissions and all estate fault reports, including residents' reports. Manage every user's role within those estates. Only managers invite new users, including other managers. Deletion of an estate additionally requires current ownership. |
| Council, `COUNCIL` | CRUD access to estate assets and read access to the estate management dashboard. No invitation, role-management or estate-wide fault-report authority is granted by this role. |
| Resident, `RESIDENT` | Create fault reports only in estates where assigned; read their own past reports. Residents may be assigned to multiple estates. No update/delete of reports or access to other residents' reports. |
| Crew, `CREW` | CRUD access to all fault reports in assigned estates, including modifying residents' reports. No estate, asset, invitation or role-management authority is granted by this role. |

CRUD means create, read, update and delete in the listed area. The matrix records
the broader intended authority, not authorization to implement every lifecycle
operation here. Asset editing is out of scope. Current staff report editing is
limited to location correction under [fault report locations](fault-report-locations.md);
all other report information is retained. Report deletion and broader edits are
out of scope, as is estate deletion. Custom role and permission definition
authoring remains the future follow-up requested by the user; the full policy
above records managers' intended authority when that follow-up is built.

All permissions are evaluated for the target estate from current Neon records.
A manager in A and resident in B has manager authority only in A. WorkOS supplies
identity, sessions and invitation delivery/verification; its role claims do not
grant application permissions after the planned Neon cutover.

## Behaviour

### Ownership and manager authority

- Any authenticated account may create an estate (self-service policy agreed
  2026-10-20). Creation atomically records the creator as `ownerUserId` and
  establishes their MANAGER membership only in the new estate. Existing
  memberships and invitations are preserved. Ordinary sign-up does not create
  estate membership; no trusted provisioning step is needed for creation. See
  [self-service-estate-creation.md](self-service-estate-creation.md).
- Managers can manage users and their roles only in estates they create or are
  assigned to. They can invite Council, Resident, Manager or Crew. Invited
  managers receive the same estate-local management authority as other managers.
- Council, Resident, Crew and legacy MEMBER grants cannot invite, even if an old
  `canInviteMembers` flag is true. Invitation authority derives from MANAGER;
  it is not delegable to a non-manager. Remove the old delegation UI and retire
  or make the legacy permission endpoint unavailable during cutover.
- Only the current owner can transfer ownership, and the target must be another
  existing manager/admin in the same estate. The transaction locks/rechecks the
  estate, caller ownership and recipient's current MANAGER membership before
  updating `ownerUserId`. An unassigned recipient is ineligible. A Council,
  Resident or Crew recipient needs an explicit role change before transfer;
  transfer never establishes or converts membership.
- Transfer preserves the former owner's manager membership and the new owner's
  manager membership. Their ordinary management powers remain; only the new
  owner holds the ownership-specific deletion/transfer authority. Neither an
  invitation nor a general role update can change `ownerUserId`.
- Record owner-only deletion eligibility in the permission model. Do not add,
  enable or reinterpret a delete/deactivate endpoint in this change. The user
  explicitly left estate deletion implementation outside scope.
- The manager role editor can explicitly change another member's estate role,
  including to/from MANAGER or RESIDENT. An invitation cannot silently convert
  an existing membership. Role changes and removal must check transactionally
  that an owner remains. With one `ownerUserId`, reject removal/demotion of the
  current owner until ownership has transferred to another existing estate
  Manager.
- A non-owner Manager cannot voluntarily give up estate access: reject both
  self-removal and a self-role change away from MANAGER. Only another current
  Manager in that estate can remove or demote them. Identify self by the
  authenticated subject and enforce this on the server, including direct API
  requests; reject self-removal/self-demotion with 409. Ownership transfer itself
  preserves the former owner's MANAGER role.

### Invitations and acceptance

- The form offers Council member, Resident, Manager and Crew alongside email.
  Spring validates role and current manager membership in the target estate;
  a manually altered request cannot bypass this check.
- Persist the selected role before WorkOS dispatch. Email and in-app acceptance
  activate exactly that estate role; acceptance cannot supply another role,
  inviter, estate or owner. Sending alone grants no estate access.
- Existing invitation rows backfill to COUNCIL. Legacy email-only requests mean
  COUNCIL. Explicit null, unknown values, MEMBER, OWNER and ADMIN are invalid;
  the UI uses Manager/Admin terminology but sends canonical MANAGER.
- New accounts use the existing WorkOS email flow; existing accounts retain the
  IN_APP fallback. Verified identity, normalized email matching, provider
  acceptance checks and seven-day expiry remain.
- Preserve one current invitation slot per estate and normalized email across
  roles. Cancel an outstanding attempt before sending a different role. A failed
  SENDING retry reuses its role, inviter, payload and delivery UUID; a role change
  returns 409 before provider dispatch. A new attempt gets a fresh UUID.
- Reject invitations to an existing target-estate member or owner with 409.
  Acceptance rechecks membership under locks and never overwrites a different
  role. Define same-role reconciliation compatibility explicitly in tests; it
  must not grant additional permissions or reactivate a removed membership.
- A resident may accept invitations into multiple estates. Acceptance in B
  preserves their resident membership in A. Concurrent acceptance in different
  estates can succeed; the `(estateId, userId)` key prevents duplicate membership
  within one estate. An existing different role in B requires explicit conversion.
- Manager removal or demotion blocks subsequent invitation requests with the
  same JWT. Acceptance must recheck that the inviter is still an authorized
  target-estate manager, alongside invitation/estate state. Cancel their pending
  invitations on manager removal/demotion so old dispatch callbacks cannot
  restore access. This supersedes delegation-based continuation in the old draft.
- Managers can list/cancel estate invitations, list/remove members and change
  member roles. Removing a resident membership stops creation only in that
  estate and preserves the user's other memberships and report history.
- Inactive estates reject new invitations and activation. Existing administrative
  reads/removal/cancellation retain current inactive-estate behavior until their
  individual contracts are revised; no estate reactivation is added here.

### Reports, assets and navigation

- Managers and Crew read estate-wide fault reports and correct their location
  under the separate fault-report-locations implementation. Location is the only
  report field staff can currently edit. Preserve the report ID, estate,
  submitter, title, description, status, creation time, images and image metadata;
  only `locationId` and the existing `updatedAt` change on a successful correction.
  Resident history endpoints remain submitter-only and show the corrected
  location on subsequent reads. Council gains no estate-wide report access.
- Do not implement broader report editing or deletion here. The broader CRUD
  role intent does not authorize text/status/image changes, cross-estate moves,
  submitter replacement or image cleanup in a location correction.
- Residents can select any active estate where they hold RESIDENT membership
  when submitting a report. Spring validates that selected membership, location
  and estate inside the write transaction. It never trusts an arbitrary selected
  estate or infers one from the first membership row.
- Revoking membership in A stops new A submissions without affecting B or
  deleting submitted reports. Own-history reads remain submitter-based;
  location corrections retain all other report information and image access.
- Managers and Council have the broader asset CRUD authority in the role matrix;
  asset editing and deletion lifecycle changes are out of scope here. Only
  managers can write estate management settings/locations; Council has
  estate-dashboard read access. Crew
  report permissions include the minimum location reads needed for the form,
  filtering and correction, without asset or estate-management write authority.
- `/invitations` is reachable by every authenticated user, including unassigned,
  resident-only and crew-only accounts. Cards show estate, offered role and expiry
  with explicit acceptance. Loading never explicitly accepts an invitation.
- WorkOS sign-in returns invitation recipients to `/invitations`, preserving
  PKCE/state. Retain verified reconciliation of provider-accepted email invites.
- Acceptance refreshes access before navigation: Manager/Council can open the
  permitted estate dashboard; Resident can open `/reports/new`; Crew can open
  the estate report list. Mixed-role accounts retain all authorized destinations.
  Failures retain input/error/retry state and never mount unauthorized queries.

## Data

Only Prisma changes database shape; regenerate jOOQ rather than editing it.
This table is a proposed implementation plan, not an applied migration.

| Prisma model | Planned change |
| --- | --- |
| `EstateInvitation` | Non-null `role: String @default("COUNCIL") @db.VarChar(20)`; COUNCIL backfill; check allowing COUNCIL, RESIDENT, MANAGER, CREW. Preserve lifecycle/provider fields and unique estate/email slot. |
| `EstateUser` | Allow MANAGER and CREW. Preserve `(estateId, userId)` key. Remove the partial unique index limiting RESIDENT to one estate. Membership revocation deletes only that estate's row. Retire `canInviteMembers` as an authority; agree compatible column/response removal before coding. |
| `Estate` | Preserve single `ownerUserId` as ownership authority and never leave the estate ownerless. Creation establishes owner MANAGER membership; transfer requires an existing target-estate MANAGER. No deletion schema or migration in this change. |
| `IssueReport`, `IssueReportImage` | Location-only staff editing belongs to fault-report-locations; preserve every other report field and image relationship except the correction's `updatedAt`. No broader report lifecycle changes here. |

Use an initial fixed role enum for DTO validation. Future custom role/permission
schemas belong to the follow-up below. Existing-account role mapping, roleless
account eligibility, legacy MEMBER/delegate classification and live imports are
deferred. Missing membership never triggers automatic Manager promotion.

Report/invitation/role writes must lock and recheck the relevant estate,
membership and resource consistently. Multi-estate resident acceptance no longer
uses a global resident uniqueness constraint. Dropping that constraint must be
a new migration, never an edit of the applied resident migration.

## API

These are proposed contracts for review. Existing invitation URLs/DTO names may
remain to avoid an unrelated rename. Product copy says estate invitations.
All frontend request/response types must be generated from real Java DTOs.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/council-invitations` | `CouncilInvitationRequest { email: string, role?: COUNCIL \| RESIDENT \| MANAGER \| CREW }` | 201 existing invitation DTO plus selected `role` | Target-estate Manager. |
| GET | `/estates/{estateId}/council-invitations` | None | 200 invitation DTO array, each with `role` | Target-estate Manager. |
| DELETE | `/estates/{estateId}/council-invitations/{invitationId}` | None | 204 | Target-estate Manager. |
| GET | `/council-invitations` | None | 200 pending DTO array plus offered `role` | Verified matching recipient. |
| POST | `/council-invitations/{invitationId}/accept` | None | 200 existing `AcceptedInvitationsResponse { estateIds: UUID[] }` | Verified matching recipient; activates stored role. |
| POST | `/council-invitations/accept` | None | 200 existing accepted response | Authenticated recipient; provider acceptance verified. |
| GET | `/estates/{estateId}/members` | None | 200 member DTO array with estate `role` | Target-estate Manager. |
| PUT | `/estates/{estateId}/members/{userId}/role` | Proposed `UpdateEstateRoleRequest { role: COUNCIL \| RESIDENT \| MANAGER \| CREW }` | 200 member DTO with saved role | Target-estate Manager; owner/demotion safeguards apply. |
| DELETE | `/estates/{estateId}/members/{userId}` | None | 204 | Target-estate Manager; ownership safeguards apply. |
| POST | `/estates/{estateId}/ownership-transfer` | Proposed `{ newOwnerUserId: string }` | 200 estate DTO | Current owner; recipient must already be a different MANAGER in that estate. No membership creation or implicit role conversion. |
| GET | `/access/context` | None | 200 revised capabilities and resident estate collection | Any authenticated subject; private, no-store. |
| GET | `/resident/context` | None | 200 proposed `{ estates: { id: UUID, name: string }[], canSubmit: boolean }` | Authenticated subject; active resident assignments only. |
| GET | `/resident/locations` | Required `estateId: UUID` | 200 existing location DTO array | RESIDENT in the selected estate. |
| POST | `/resident/reports` | Existing multipart report fields plus required `estateId: UUID` | 201 existing report detail | RESIDENT in selected active estate. |

Existing invitation fields, statuses and DTOs are described in
[the as-built contract](../../.docs/api/council-invitations.md).
Example: `{"email":"crew@example.com","role":"CREW"}` creates a Crew offer;
acceptance grants Crew membership only in the offered estate; current staff
report reads and location-only edits follow fault-report-locations.

Replace singular `residentEstate` with a resident estate collection in access
context and update all clients together. Resolve capabilities per estate for
management, assets, report CRUD, invitations, roles and ownership transfer.
An ownership badge may be derived for display, but must not replace the member's
MANAGER role or imply a separate configurable OWNER role.

Current staff report reads and location-only editing are specified in
fault-report-locations. Asset editing and broader report CRUD are not implemented
by this invitation change. Owner-only repository predicates need focused
manager/council authorization changes where allowed; do not redefine every
`findOwned` check globally. The existing broad `/api/admin/users/...` estate grant
and role-management paths must become estate-scoped and manager-authorized or
be retired with their clients; a manager cannot enumerate unrelated estates or
users. Retire invitation-permission mutations; do not retain a hidden delegate
path. Ownership transfer never adds deletion implementation.

Retain controlled errors: 400 invalid role/body/UUID; 401 missing identity;
403 known estate access without the required capability; 404 inaccessible or
missing estate/member/resource; 409 membership, stale mutation or lifecycle
conflict; 502 provider failure; 503 configuration/access storage unavailable.
Preserve the existing invitation retry/cancellation and private-image behavior.
Exact new DTO fields/statuses and compatible rollout need review before coding.

## Frontend

- Retain folder-based estate member routes and existing shadcn Select, Label,
  Button, Card, Badge and Dialog components. Managers see all four invitation
  choices and member-role controls. Remove delegation checkboxes and owner-only
  restrictions on member/invitation management.
- Render ownership separately from the role. Offer ownership transfer only to
  the current owner and only to another existing manager/admin in that estate.
  Explain that transfer is required before removing or demoting the owner. Do
  not add estate delete/deactivation UI as part of this work.
- Hide Manager self-removal and self-demotion controls. Another same-estate
  Manager can perform those actions subject to owner preservation. Server
  guards remain authoritative if an old or manually altered client submits them.
- Gate estate dashboards and role-management routes using generated server
  capabilities. Staff report list/detail and location-correction controls belong
  to fault-report-locations for Managers/Crew. Do not add asset editing or broader
  report actions here. Manager/Admin is one choice.
- Add a resident estate selector from the active membership collection. Changing
  the estate clears location selection and queries locations for that estate;
  an unassigned/inactive-only user sees no submittable estate.
- Keep user- and estate-scoped query keys. Invitation/member/role mutations
  invalidate access, affected estate/member queries and resident context/location
  queries; refetch access/router state before entering a newly available screen.
  Identity changes clear prior-user queries. No raw fetch or hand-written API types.

## Edge cases

- A Crew member submits a report ID from another estate: deny without exposing
  or changing it. A Manager in A has no invitation/role-management powers in B.
- Council accesses a staff report URL or Crew an asset mutation directly: deny
  despite both roles having access to other parts of the estate.
- A former delegate's stale checkbox/token cannot authorize an invitation.
  Manager authority alone permits all four invitation roles, including Manager.
- Two resident invitations for A/B are accepted concurrently: both may succeed.
  Removing A never revokes B. A same-estate role conflict remains explicit.
- A role changes during report creation, invitation acceptance or a manager
  edit: serialize with membership changes and recheck before committing.
- Two ownership transfers race: only the currently authorized owner can commit;
  stale former-owner requests cannot transfer again or retain deletion authority.
- Removing/demoting the owner is rejected until ownership transfers, including
  under concurrent role changes. Transfer to a non-member or non-manager is
  rejected; an explicit promotion must complete first.
- A non-owner Manager tries to remove or demote themselves: reject without
  changing membership or pending invitations. A different current same-estate
  Manager may remove/demote them under the normal authorization and owner guards.
- A location correction preserves report text, status, submitter, estate,
  images and creation time; resident history shows the corrected location.
  No broader editing or deletion operation is added.
- Wrong recipient, expiry, cancellation, removed/demoted inviter and superseded
  delivery UUIDs cannot activate access. A failed lookup never grants authority.

## Implementation phases

- [x] Confirm Manager/Admin alias, Crew report CRUD, Council asset CRUD,
  manager-only invitations to every role and multi-estate residents (2026-10-18).
- [x] Record owner creation/transfer/deletion policy; estate deletion is out of scope.
- [x] Confirm at least one owner per estate and transfer only to an existing
  same-estate Manager (2026-10-18).
- [x] Defer account migration; disallow Manager self-removal/self-demotion;
  exclude asset editing and place location-only staff report edits under
  fault-report-locations (2026-10-18).
- [x] Agree this revised spec and final API details.
  Recorded ADR 0028 superseding affected parts of 0020/0024/0027; retained history.
- [x] Write and run failing role-matrix and schema-migration tests. Extend role values,
  backfill legacy invitations, remove global resident uniqueness and regenerate jOOQ.
- [x] Write and observe failing invitation tests for all roles, manager-only
  authority, existing-member protection, retries, revocation and concurrent acceptance.
- [x] Write and observe failing owner-transfer/member-role tests, including
  cross-estate denial, revocation, Manager self-removal/self-demotion rejection
  and owner/demotion guards; implement approved APIs.
- [x] Write failing multi-estate resident API/UI tests before replacing singular
  context, adding estate selection and validating selected membership at commit.
- [ ] Under fault-report-locations, write failing Manager/Crew report-read and
  location-correction tests, preserving all other fields and resident history.
  Asset editing and broader report CRUD are outside this invitation change.
- [x] Regenerate OpenAPI/types, write and observe failing UI/route tests for
  four role choices, role editing, ownership display and capability-based navigation.
- [x] Run Nx-backed targeted tests, then `pnpm check-types`, `pnpm test` and
  `pnpm fix`. Update matching `.docs/api/`, `.docs/frontend/` and their index
  only when behavior is built. Leave changes uncommitted; install nothing.

## Future requirement: custom roles and permissions

Managers must be able to create new roles and new permissions, and CRUD their
estate roles/permissions through role management. Creation of custom definitions
remains the future follow-up requested in the original message. Current
invitation/assignment work uses the four preset roles; record the full intended
manager authority without silently building the authoring system now.

That follow-up needs an agreed spec for estate-local definitions, permission
semantics/enforcement, assignable capabilities, role/permission deletion and
references, custom-role invitations and migration from preset role values.
A permission name alone must not create server authority. Ownership remains a
relationship and owner-only actions remain protected. Definitions and grants
live in Neon; WorkOS does not supply role authority.

## Out of scope

- Existing-account migration, role inventories/imports and automatic Manager
  designation of roleless accounts; revisit separately when requested.
- Asset editing/deletion lifecycle changes, broader report editing and report
  deletion. Current staff editing is location-only under fault-report-locations.
- Estate deletion implementation, including choosing permanent deletion versus
  deactivation. Existing deactivation behavior is not reinterpreted here.
- Implementing the future custom role/permission authoring system in this
  invitation change; its detailed contract is a separate spec.
- WorkOS organization-role mutation, a separate platform-admin role, cross-estate
  authority, bulk invitations, replacement mail infrastructure or live push updates.
- Invitations as ownership transfer or implicit same-estate role conversion.
- Cross-estate report moves, resident impersonation or unrelated UI refactors.

## Open implementation questions

The previously listed policy questions are resolved or deferred: Managers cannot
remove/demote themselves; owner preservation and same-estate Manager transfer
eligibility are confirmed. Account migration is deferred. Asset editing is out
of scope, and location-only report editing belongs to fault-report-locations.
The invitation/member/ownership APIs, generated contract and onboarding are
implemented and verified. Account inventories and broader CRUD lifecycle
decisions remain outside this completed invitation scope.

Estate deletion mechanics are outside scope, not an unanswered requirement for
this work. The separate report-location feature and broader operations remain planned.


## Verification (2026-10-18)

Observed failing role-validation, role-schema/activation, Manager safeguards,
resident estate-selection, recipient-route, access-storage and OpenAPI regression
tests before their changes. The completed workspace run passes 467 server tests
and all web/ML targets; workspace type checks, production web build and formatting
pass. Prisma migration 20261018093417_estate_role_invitations is applied to the
configured dev database, and Prisma/jOOQ/OpenAPI/TypeScript are regenerated.
Account assignments are not migrated, delivery is mocked in tests, and changes
remain uncommitted. Report-location editing is deliberately a separate feature.
