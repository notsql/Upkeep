# Move role authority from WorkOS to Neon

**Status:** draft; Neon authority and Manager/Admin alias confirmed on 2026-10-18;
estate invitation/member authority and access projection implemented;
existing-account migration deferred; broader operations remain separate
**Owner:** unassigned
**Related features:** [Estate roles and invitations](estate-role-invitations.md),
[existing admin safeguards](admin-role-safeguards.md),
[resident authorization](resident-estate-user-authorization.md),
[fault report locations](fault-report-locations.md)

## Problem

Estate memberships and ownership already use Neon, while existing admin guards,
role editing and some estate-creation checks still depend on WorkOS roles.
Provider updates and stale JWT claims therefore disagree with estate-local
permissions and immediate membership revocation.

The earlier draft proposed a separate application-wide ADMIN/USER system. The
user has now confirmed that Manager and Admin are the same role, with access
limited to assigned estates. That proposal is superseded. Do not implement its
`ApplicationRoleAssignment(ADMIN/USER)` table, global admin endpoints or global
admin counter/lock as an independent authority.

## Confirmed direction

- WorkOS authenticates users and supplies identity, profiles, sessions and the
  existing invitation delivery/verification flow. Its role catalogue, role
  assignments and JWT role claims cease to authorize the application.
- Neon stores role assignments and permissions. MANAGER is the canonical planned
  name for Manager/Admin; there is no separate platform-admin role.
- `EstateUser(estateId, userId)` supplies the estate role. MANAGER manages the
  assigned estate, its users/roles, assets and all fault reports. COUNCIL manages
  assets and reads the estate dashboard. CREW manages all estate fault reports.
  RESIDENT submits in assigned estates and reads their own history. The complete
  matrix is maintained in the [estate role spec](estate-role-invitations.md).
- Ownership stays in `Estate.ownerUserId`. The creating manager becomes owner;
  ownership can transfer only to another existing manager/admin in the same
  estate. Council, Resident or Crew recipients need an explicit role change
  first; transfer never establishes membership. Every estate must retain at
  least one owner, so the current single owner cannot be removed or demoted
  before transfer. Only the current owner has estate deletion authority;
  deletion implementation is out of scope.
- Existing-account migration is deferred at the user's request. The earlier
  roleless-account Manager designation is not an active requirement. Do not
  inventory, import or automatically reclassify existing accounts in this work.
  Required role/schema changes remain separate from account migration.
- Only managers invite users, including other managers. Non-manager invitation
  delegation is removed. Residents may hold assignments in multiple estates.
- Managers' custom role/permission creation remains a future follow-up. Its
  definitions and grants must also use Neon and remain bounded by estate scope.

## Behaviour

- A valid JWT proves the subject, not their estate authority. An old `admin`
  claim without a current Neon MANAGER grant cannot authorize an estate
  operation. A Neon Manager with an ordinary provider role can perform their
  estate's manager operations.
- A Manager in A cannot list users, change roles, invite users or modify data
  in B without the relevant B assignment. Creating an estate grants its creator
  MANAGER membership and ownership transactionally; it does not grant access
  to anyone else's estates.
- Ordinary registration, email domain and first sign-in never grant manager
  membership. Any authenticated account can create an estate and becomes owner
  and MANAGER only in that new estate under the self-service creation update
  (2026-10-20). No prior Manager eligibility provisioning is required. Account
  migration remains deferred. Do not infer existing-estate authority from a
  client role, provider admin claim or an absent membership.
- Role changes and revocation take effect on subsequent requests with the same
  JWT. Use current Neon records and recheck within writes; no session-duration
  authorization cache or provider fallback is permitted.
- Failed access lookup returns a controlled 503 and denies protected operations.
  An absent membership means no estate grant; a failed query is not an absent
  membership. Creation requires authentication independently of prior estate
  assignments; access lookup failure never fabricates existing-estate authority.
- The role editor targets estate/user IDs and saves estate-local roles to Neon.
  Manager/Admin is one choice. Ownership is displayed separately and never
  assigned through a role selector. User IDs are stable WorkOS subjects, not
  provider organization-membership IDs or mutable emails.
- Managers can manage existing members' roles, including other managers. Joining
  a new user to an estate uses invitations; do not retain generic grant endpoints
  as an invitation bypass. Explicit same-estate role changes preserve report
  identity/history and memberships in every other estate.
- Manager removal/demotion immediately removes that estate's management powers.
  Role changes and removal must transactionally preserve an owner. With the
  current single-owner model, transfer to another existing estate Manager is
  required before owner removal/demotion. Non-owner self-demotion
  and self-removal are also blocked: a Manager cannot give up their
  own access. Only another current Manager in that estate may remove or demote
  them. Enforce self checks using the authenticated subject in the server
  transaction, not just UI visibility. Do not reuse the WorkOS organization counter.
- Identity lookup through WorkOS can enrich an authorized estate roster with
  names/emails. It cannot turn the manager UI into an unscoped user directory.
  A provider directory outage does not restore provider role authority.
- Changing a WorkOS role after cutover has no application effect. Provider role
  update APIs are not called. Browser route entry, navigation and action controls
  use Spring capabilities rather than `auth.role` or broad platform-admin flags.

## Data

Prisma owns schema changes; only `apps/server` accesses Neon at runtime.

| Model / record | Planned treatment |
| --- | --- |
| `EstateUser` | Estate-local canonical roles MANAGER, COUNCIL, RESIDENT, CREW. Preserve composite key; remove the one-resident-estate index through the invitation plan's schema migration. Legacy delegation flags stop authorizing invitations; existing-account role mapping is deferred. |
| `Estate` | Preserve `ownerUserId`; creation establishes owner Manager membership and transfer requires an existing same-estate Manager. Existing-account mapping is deferred. |
| `EstateInvitation` | Persist selected estate role and enforce manager-only invitation policy under its feature spec. |
| Future custom role/permission definitions | Separate agreed schema and enforcement spec; not implemented in this authority migration. |
| `IssueReport`, `IssueReportImage` | This authority migration does not delete or reassign reports/images. |

Do not create the earlier draft's global ADMIN/USER table or global admin lock.
Any required concurrency coordination must follow the agreed estate-level
owner/manager safeguards. Regenerate jOOQ after Prisma migrations; never edit
applied migrations or generated database classes.

## API

These contracts are proposals for review, not changes to the as-built API.
Use real Java DTOs, generated OpenAPI and generated frontend types.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/access/context` | None | 200 revised access DTO with estate roles/capabilities and resident estate collection | Any authenticated subject; private, no-store. No separate platform-admin authority. |
| GET | `/estates/{estateId}/members` | None | 200 existing member DTO array extended with role | Manager in that estate. WorkOS supplies profiles only for authorized members. |
| PUT | `/estates/{estateId}/members/{userId}/role` | Proposed `{ role: MANAGER \| COUNCIL \| RESIDENT \| CREW }` | 200 member DTO with saved role | Current Manager in that estate, checked in the transaction; agreed ownership/demotion guards apply. |
| DELETE | `/estates/{estateId}/members/{userId}` | None | 204 | Current target-estate Manager; ownership safeguards apply. |
| POST | `/estates/{estateId}/council-invitations` | Email and selected role | 201 invitation DTO | Current target-estate Manager; includes invitations to Manager. |

The full invitation/ownership contract belongs to the estate role spec. Role and
permission definition CRUD endpoints belong to the future authoring spec.
Do not add the superseded global `/api/admin/roles`, `/api/admin/users` directory
or `/application-role` mutation from the previous draft.

Retire the WorkOS organization-role editor contracts with their clients:

- GET `/api/admin/users/organization/{organizationId}/roles`.
- GET `/api/admin/users/organization/{organizationId}/members` as a role roster.
- GET `/api/admin/users/organization/all` as a role scope selector.
- PUT `/api/admin/users/{membershipId}/role` with provider `roleSlugs`.

Existing `/api/admin/users/{userId}/estates` grant/list/delete APIs must be
replaced with estate-scoped manager workflows or constrained/retired in the same
rollout. They cannot expose arbitrary estates/users or bypass invitations.
Remove the old invitation-permission mutation so legacy delegates cannot invite.

Errors remain controlled: 400 invalid input; 401 no verified identity; 403 known
estate relationship without required permission; 404 inaccessible/missing estate,
member or identity target; 409 role/ownership/lifecycle conflict; 502 identity
provider failure; 503 access database/configuration unavailable. Retain explicit
method/path authorization and deny unknown business operations.

## Frontend

- Replace the WorkOS organization-role editor with estate-scoped management of
  users/roles. Reuse folder-based routes and existing shadcn Table, Card, Select,
  Label, Button, Dialog and Alert components. No separate Admin/Manager choices.
- Gate the dashboard and all queries with the selected estate's generated role
  management capability. Remove the nested `auth.role` check and any unscoped
  platform-admin guard. Unresolved/failed access must not mount privileged data.
- Include the selected estate in user-scoped React Query keys. Mutations use
  generated-client hooks; invalidate roster, estate/access and affected resident
  context queries. Other tabs see fresh capabilities on refetch; Spring rejects
  revoked access immediately even if the UI is stale.
- Clear legacy unscoped role/user caches and prior-user queries on identity
  changes. Identity enrichment never fetches an unrelated global roster.

## Authority cutover and deferred account migration

Existing-account inventories, legacy role mappings, roleless-account Manager
designation and account import tooling are deferred. Do not implement or perform
them as part of this work. Revisit their contract when the user resumes migration.

The remaining authority work requires coordinated API/UI replacement: use Neon
checks, retire provider-role mutations/global guards and non-manager delegation,
and enforce owner preservation and Manager self-removal/self-demotion guards.
No runtime provider-role fallback is permitted. Required Prisma schema migrations
and jOOQ generation are not account migration and remain in the relevant feature
plans. Deployment/cutover details still need review before implementation.

Verify unchanged-token revocation, cross-estate denial, invitations to each role,
owner preservation, Manager self-action rejection and multi-estate residents.
Staff report reads and location-only editing belong to fault-report-locations;
asset editing and broader report edits/deletion are outside this work.

No live accounts, invitations or provider settings are changed by this spec task.

## Edge cases

- Provider admin claim with no local grant: deny; current local Manager with an
  ordinary identity token: allow only the assigned estate's operations.
- Two managers edit/demote one another: recheck the actor under the same agreed
  estate-level locking/safeguard boundary; stale privilege cannot commit.
- Owner removal/demotion or concurrent ownership transfer: preserve the ownership
  invariant and reject stale former-owner actions. A transfer cannot silently
  promote a Council/Resident/Crew member or add a recipient to the estate.
- A Manager attempts self-removal or a self-role change away from MANAGER:
  reject without changing membership or pending invitations. Another current
  same-estate Manager may act subject to ownership safeguards.
- Resident assignments in multiple estates coexist with other-estate manager or
  council roles; a mutation in A never silently changes B.
- Provider profile lookup fails: do not change Neon authority or partially apply
  a role mutation that required identity validation.
- An old client calls retired role/delegation endpoints: it cannot write provider
  roles, use delegated invitation powers or restore global admin access.

## Implementation phases

- [x] Confirm Neon role authority, Manager/Admin alias and estate scope (2026-10-18).
- [x] Confirm owner preservation, existing same-estate Manager transfer targets
  and Manager self-removal/self-demotion rejection (2026-10-18).
- [x] Defer account migration and roleless-account designation (2026-10-18).
- [ ] Agree final authority/API contracts and deployment details before
  implementation; record the new ADR. Account migration remains outside scope.
- [ ] Write and run failing lookup/HTTP tests for local versus provider
  authority, each role boundary, missing identity and access lookup failures.
- [ ] Write and observe failing concurrency and Manager self-action tests, then
  implement the approved resolver, mutations and safeguards. No account import.
- [ ] Regenerate API types and write failing UI tests for estate scoping, role
  saving/errors, cache isolation and retired provider/delegation paths.
- [ ] Run Nx-backed checks, then `pnpm check-types`, `pnpm test` and `pnpm fix`.
  Use isolated migrated Postgres and mocked identity APIs; install nothing.
- [ ] Verify the reviewed authority rollout, then update architecture and matching `.docs/`
  only when behavior is built. Leave all changes uncommitted for the human.

## Out of scope

- Existing-account migration, role inventories/imports, legacy grant mapping
  and automatic Manager designation of roleless accounts.
- Moving authentication, passwords, MFA, sessions or profile authority from WorkOS.
- A distinct platform-admin role or global access to every estate/user.
- Estate deletion implementation or automatic conversion of provider labels.
- Implementing custom role/permission authoring or unrelated report/asset CRUD
  lifecycle changes inside this authority migration.

## Open implementation questions

Owner preservation, transfer to an existing same-estate Manager, and rejection
of Manager self-removal/self-demotion are settled. Account migration and its
provisioning/inventory questions are deferred. Final API/authority rollout
details remain subject to review; no account import is authorized by this spec.


## Implemented invitation scope (2026-10-18)

The estate role invitation implementation now uses Neon Manager authority,
retires delegation, denies global provider-role/grant routes, protects ownership
and Manager self-actions, and projects resident estate collections. Its API/UI,
schema sources and tests are documented in .docs/api/council-invitations.md,
.docs/api/access.md and .docs/frontend/council-invitations.md. Migration/import,
custom roles, broader asset permissions and staff report-location work remain
outside that completed invitation scope.
