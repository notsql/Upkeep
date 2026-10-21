# Self-service estate creation

**Status:** built (2026-10-20); feature checks pass; full server suite has 13 pre-existing bulk-floor failures
**Owner:** unassigned
**Related features:** [Estate management](estate-management.md),
[estate roles and invitations](estate-role-invitations.md)

## Problem

An account without existing owner or Manager authority cannot create its first
estate. `AccessService` derives `canCreateEstate` from current estate management
authority, and `SecurityConfig` checks that capability for `POST /estates`.
The web route guard also redirects accounts without workspace access away from
the creation form, while navigation offers no estate entry for those accounts.

Allow every signed-in account to create an estate and become its owner and
Manager. Existing ownership and membership storage already supports this.

The current specs disagree: estate-management's Behaviour allows any signed-in
creator, but its API table and estate-role-invitations restrict creation to
Managers/owners. The agreed self-service policy replaces those creation restrictions.

## Behaviour

- Every authenticated account has `canCreateEstate=true`, including unassigned,
  Resident-only, Crew-only, Council-only, legacy Member, Manager and owner accounts.
  WorkOS role claims do not change creation eligibility.
- A missing, blank or invalid authenticated identity cannot create an estate.
  The controller continues rejecting missing identity in local development too.
- Successful creation uses the authenticated JWT subject as `Estate.ownerUserId`
  and inserts that subject's `MANAGER` membership in the new estate atomically.
  The request cannot choose another owner or role.
- Creating an estate preserves every existing estate, membership and invitation.
  A Resident in A who creates B remains a Resident in A and becomes owner/Manager
  only in B. Creation eligibility alone grants no authority over existing estates.
- `canEnterWorkspace` retains its current meaning, derived from existing estate
  management/report capabilities. An unassigned account has
  `canCreateEstate=true`, `canEnterWorkspace=false` and an empty estate collection
  until it creates or is assigned an estate.
- Signed-in users can open `/estates` and `/estates/new`, including the router's
  trailing-slash variants, without `canEnterWorkspace`. Other estate routes
  continue checking their target estate's capabilities.
- The directory continues listing only management-visible estates. Resident-only,
  Crew-only and unassigned accounts can therefore see an empty directory with a
  creation action without gaining management visibility into their assignments.
- Desktop and mobile navigation expose an Estates entry to every signed-in
  account. The existing directory offers Create estate. The unassigned Home
  state also offers a creation action instead of only telling users to await
  assignment. Existing Resident/Crew landing destinations and report/invitation
  links remain available.
- The creation form's Back, breadcrumb and Cancel links lead to the now-accessible
  directory. The existing form, validation and pending-submission controls are reused.
- After creation, the client refreshes access and route state before opening the
  new estate details. The creator sees their Manager/owner controls immediately,
  without signing in again or reloading the page.
- Required fields, normalization, global code uniqueness, validation errors and
  duplicate-code errors retain their existing behavior.

## Data

No Prisma schema change, migration, backfill or jOOQ regeneration is required.

| Existing Prisma model | Use |
| --- | --- |
| `Estate` | Store the new estate with the authenticated subject as `ownerUserId`. |
| `EstateUser` | Insert `role=MANAGER` for that user and new estate, using the existing `(estateId, userId)` key. |

Reuse the existing transactional `EstateRepository.create`. There is no global
Manager flag, account-provisioning job, new role or membership conversion.

## API

Existing paths and DTO shapes remain. The change is eligibility and the meaning
of the existing creation capability.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/access/context` | None | 200 existing `AppAccessResponse`; `canCreateEstate=true` | Any authenticated subject |
| POST | `/estates` | Existing `EstateRequest` | 201 existing `EstateResponse`, `owned=true`; Location `/estates/{id}` | Any authenticated subject |
| GET | `/estates` | Optional `status=ACTIVE\|INACTIVE\|ALL`, default ACTIVE | 200 existing `EstateResponse[]`; empty if no management-visible estates | Any authenticated subject; existing row scoping |

`EstateRequest`: required `name: string` (max 200), `code: string` (max 50),
`address: string` (max 500), `postalCode: string` (max 20); optional nullable
`description: string` (max 2000). Required strings are nonblank. Strings are
trimmed and code is uppercased.

Creation retains 400 for invalid input, 401 for missing/invalid authentication,
409 for duplicate estate code and 503 for storage failure. Existing-role
ineligibility no longer produces 403 for an otherwise valid creation request.
Access context retains `Cache-Control: private, no-store`.

Example: an authenticated Resident in A sends `POST /estates` with
`{"name":"Maple Grove","code":"MG-001","address":"1 Grove Road","postalCode":"123456"}`.
The response is 201 with `owned=true`. Subsequent access context includes
MANAGER capabilities for the new estate and the unchanged RESIDENT assignment in A.

## Implementation approach

- Server: set the existing creation capability to true in `AccessService.context`.
  Replace the creation-only capability lookup in `SecurityConfig` with
  `.authenticated()` for `POST /estates`; remove imports/injection made unused
  by that change. Retain the controller's JWT-subject validation and repository
  transaction. Do not alter estate-specific authorization predicates.
- Routes: handle the directory and creation paths in `_auth/route.tsx` before
  the workspace gate, after resolving authentication/access. Keep the creation
  capability check and exact path matching, including trailing slashes; do not
  exempt every `/estates/**` route.
- UI: adjust `app-navigation.tsx` and the unassigned Home state to expose the
  directory/creation flow. Reuse folder-based routes and existing shadcn
  components, keeping changes within the affected screens.
- Mutation: extend `useSaveEstate`'s create-success flow to refresh
  `[userId, "app-access"]` and invalidate/re-evaluate router access before
  details navigation. Preserve existing estate-detail cache writes and
  estate-list/dashboard invalidations. Keep requests in typed query/mutation
  hooks and scope caches to the current user.

## Edge cases

- First creation starts with cached empty access. The subsequent details route
  and navigation must use freshly resolved access containing the new estate.
- If access refresh fails after a successful POST, show that creation succeeded
  but access could not refresh. Retain the created estate ID and allow retrying
  access/navigation without posting another estate or reporting creation failed.
- A failed POST preserves form input and creates no partial ownership/membership.
- A Resident, Crew or Council creator cannot use their new estate's Manager
  authority to edit, invite into or read restricted data from an older assignment.
- Concurrent attempts using the same normalized code retain the existing unique
  constraint: one succeeds and the other returns 409. Inactive estates continue
  reserving their code. No new idempotency mechanism is introduced.
- Session expiry during submission requires sign-in. Switching accounts must not
  expose the previous user's cached estate or capabilities.
- Access storage failure must not be treated as an empty successful capability
  response. Existing management guards and final API deny rules remain enforced.

## Implementation phases

- [x] Human reviewed the plan and requested tests only (2026-10-20).
- [x] Write and run failing server tests for creation and access projection by
  unassigned, Resident, Crew, Council and legacy Member accounts. Update previous
  expectations that these accounts cannot create as an explicit policy change,
  then observe those new expectations fail against the current implementation.
  Retain Manager/owner coverage and unauthenticated rejection.
- [x] Implement the narrow server eligibility/security changes. Verify returned
  ownership, persisted MANAGER membership, transaction behavior and unchanged
  existing-estate restrictions through HTTP/database tests.
- [x] Write and observe failing route/navigation/Home tests for newly eligible
  accounts, directory/creation trailing slashes, working Back/Cancel destinations
  and direct restricted-estate URLs.
- [x] Implement the route and UI changes.
- [x] Write and observe failing first-creation tests covering fresh access before
  navigation, visible owner/Manager controls, preserved Resident permissions,
  and access-refresh failure/retry without repeating the POST. Existing details
  tests retain owner/Manager control coverage.
- [x] Implement refresh handling and retain existing dashboard/list updates.
- [x] Regenerate the API contract with `pnpm api:generate`; existing DTO shapes
  should remain compatible. Do not hand-edit generated frontend types.
- [x] Update `.docs/api/access.md`, `.docs/api/estates.md`,
  `.docs/frontend/estates.md`, `.docs/frontend/auth.md`,
  `.docs/frontend/shell.md` and the navigation description in
  `.docs/frontend/design-system.md` where affected. Check dashboard documentation
  for changed empty-state copy and keep `.docs/README.md` links current.
- [x] Reconcile creation eligibility in estate-management,
  estate-role-invitations and other affected feature specs. Add an ADR recording
  self-service creation and its estate-local authority; preserve prior decisions.
- [x] Run focused tests through Nx, then `pnpm check-types`, `pnpm test` and
  `pnpm fix`; review formatter changes and rerun affected checks if needed.
  Server context tests require Docker/Testcontainers. Install nothing and leave
  all changes uncommitted for the human.
  The full server run retains the 13 pre-existing failures described below;
  this checkbox records checks performed, not an entirely green workspace suite.

## Out of scope

- Schema changes, account migration, bulk Manager promotion or WorkOS role changes.
- Estate approval, quotas, rate limits, billing, ownership verification or custom roles.
- Changes to existing estate edit/deactivate/transfer, asset, invitation or report
  permissions; Resident submission eligibility remains membership-based.
- A new onboarding wizard, changed sign-in flow, unrelated screen refactors,
  deployment or commits.

## Open questions

None. Following test preparation, the human authorized implementation on 2026-10-20.

## Test preparation (2026-10-20)

Application code, schema and generated contracts are unchanged by this step.
Existing denial expectations were revised explicitly for the agreed creation
policy. The shared access fixture now permits creation without granting existing
estate or workspace capabilities.

- Server: clean compilation and an HTTP/database run of
  `EstateRoleAuthorizationIntegrationTests` against migrated Testcontainers
  Postgres executed 80 tests: 33 expected failures, 47 passes, zero errors.
  Failures are creation/capability denials for newly eligible accounts and the
  security filter returning 403 before validation of invalid details/blank identity.
- Web: the full Nx test target executed 405 tests: 16 expected failures and
  389 passes across 63 files. Failures cover directory/creation route access,
  missing navigation/Home actions, the trailing-slash capability bypass, and
  access refresh/recovery after creation.
- Web type checks passed, including the shared UI and API dependencies. Scoped
  frontend formatting/lint passed. Java formatting uses the existing Spotless plugin.

Reproduction from the repository root:

```bash
pnpm nx run web:test --skip-nx-cache --output-style=static
pnpm nx run web:check-types --output-style=static
./mvnw -o -pl com.proj:server clean test -Dtest=EstateRoleAuthorizationIntegrationTests
```

The server command uses Maven directly because the installed Nx Maven batch
executor ignored the test selector and ran the whole server suite. The clean,
focused Maven run above supplied the recorded server evidence. All dependencies
were already cached; nothing was installed. These were the observed failures
before implementation; final results follow.

## Implementation verification (2026-10-20)

The user subsequently authorized implementation. `AccessService` now permits
creation for every authenticated account and `SecurityConfig` requires
authentication directly for `POST /estates`. The existing ownership/member
transaction and schema are unchanged.

The web guard admits the directory and creation form before the workspace gate,
including trailing slashes. Desktop/mobile navigation and the unassigned Home
state expose creation. `useSaveEstate` retains the committed estate, cancels any
older access lookup, refreshes access and then navigates through the destination
guard. Refresh failures offer Retry access without another POST. The editor uses
existing shadcn Alert/Button and the existing folder-based routes.

- Focused Java HTTP/database tests: **80 passed**, zero failures/errors.
- Full frontend suite through Nx: **405 passed** across 63 files.
- `pnpm check-types`: passed across all three configured projects.
- `pnpm fix`: passed across all six configured projects.
- `pnpm api:generate`: succeeded with Infisical and cached Maven dependencies.
  Regenerated OpenAPI and frontend types retain all 63 schemas and 52 paths;
  the only semantic contract change is the estate-creation operation summary.
- `pnpm test`: the full Java suite ran **685 tests**, with **672 passed** and
  **13 pre-existing failures**, zero errors. All failures are in
  `LocationControllerTests` for `POST /estates/{estateId}/locations/{blockId}/floors`,
  which returns 403 because the existing security allowlist omits that endpoint.
  Those failures also appeared during test preparation before the application
  change. The floor endpoint's security rule is unchanged; no unrelated repair
  was included. The complete frontend suite was also run separately and passed.

Matching `.docs/` contracts/screens and affected feature policies are updated.
[ADR 0030](../decisions/0030-authenticated-accounts-create-estates.md) records the
creation policy. No dependencies, schema migrations, account imports, deployment
or commits were introduced.
