# Estate management

**Status:** built; report creation enforcement deferred

## Self-service creation update (2026-10-20)

Any authenticated account may create an estate, including Residents, Crew,
Council and unassigned accounts. The creator becomes owner and MANAGER only in
the new estate. Directory/creation routes require sign-in without workspace
access; target-estate guards remain. See
[self-service-estate-creation.md](self-service-estate-creation.md).

## Agreed permission update (2026-10-19)

The user approved the following API and frontend changes before implementation.

- Owners and current MANAGER members can edit details in their estate, including
  inactive estates, without changing ownership or activation state.
- Council, legacy MEMBER, Crew, Resident and unassigned users cannot edit details.
  Manager membership in another estate grants no authority here.
- Only the current owner can deactivate the estate or transfer its ownership.
- Transfer preserves the former owner's MANAGER membership and editing access,
  while immediately removing their transfer and deactivation authority.
- Editing locks the estate before checking current membership, serializing with
  role changes, removal and ownership transfer. Subsequent requests reflect
  demotion/removal even when the caller keeps the same token.
- The details page and direct edit route use the target estate's existing
  `canManageEstate` capability; ownership-only controls continue using `owned`.
  Permission loading/failure must not expose an unauthorized edit form.
- No new endpoint, DTO field, dependency or database migration is needed. Keep
  unrelated asset/location/report permissions unchanged.

Verification starts with failing HTTP/database and UI tests covering the role
matrix, other-estate Managers, revoked membership, inactive editing, direct edit
navigation and the former/new owner after transfer.

Verified after implementation: the new controller and integration tests first
failed with Manager edits returning 403; UI tests first failed on missing Manager
edit links and exposed unauthorized forms. The full workspace test suite then
passed (551 Java tests, plus web and ML), alongside `pnpm check-types` and
`pnpm fix`. `pnpm api:generate` regenerated the contract and frontend types.

## Problem

Signed-in users need to represent the properties they manage and retire properties
without destroying their history.

## Behaviour

- Any signed-in user can create an estate and becomes its sole owner, from the JWT subject.
- Lists and details use existing management visibility (owner or assigned
  Manager/Council/legacy Member). Inaccessible estate IDs return 404; Resident
  membership explicitly denies management access with 403.
- Name, code, address and postal code are required. Description is optional.
- Details are trimmed; codes are uppercase and globally unique, including inactive estates.
- Owners and assigned Managers can edit identifying details of active and inactive
  estates without changing ownership or status. Other roles cannot edit.
- Lists default to active, with inactive and all filters.
- Only the current owner can deactivate, with exact entry of the current estate
  code checked in both UI and API.
- Deactivation preserves the row and timestamps its inactive state; repeating it preserves that timestamp.
- Missing authentication is rejected even if the API is running in its open local mode.

## Data

Prisma `Estate`: UUID ID, WorkOS owner ID, identifying details, created/updated
and nullable deactivated timestamps. A unique code index and owner index support
validation and scoped queries. jOOQ sources are generated from the migrated Neon branch.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates | status=ACTIVE/INACTIVE/ALL | EstateResponse[] | Management visibility |
| GET | /estates/{id} | UUID | EstateResponse | Management visibility |
| POST | /estates | EstateRequest | 201 EstateResponse | Any authenticated subject |
| PATCH | /estates/{id} | Full identifying details | EstateResponse | Owner or assigned Manager |
| POST | /estates/{id}/deactivate | Current code | EstateResponse | Owner |

## Edge cases

- Validation failures are 400; duplicate codes are 409 without leaking SQL.
- Names may repeat. An inactive estate continues reserving its code.
- Edit and deactivation lock the estate row in a transaction, so confirmation uses
  the current code and edits cannot accidentally reactivate an estate.
- UI keeps entered data on failure and prevents repeated pending submissions.
- Query keys include the signed-in user ID so cached estate data is not shared between users.

## Out of scope

Invitation/member administration and ownership transfer are specified in
`estate-role-invitations.md`. Deletion, reactivation and broader asset/location
editing are outside this details-permission change.
Asset creation now enforces this criterion (see building-assets.md): it locks
the estate row, checks its active state and inserts the asset in the same
transaction. Report creation does not exist yet, and must do the same when it
is built.

## Verification

HTTP tests cover owner assignment, normalization, validation, duplicate errors,
owner isolation, inactive editing and deactivation confirmation/idempotency.
UI tests cover forms, failure recovery, exact-code confirmation/cancellation,
empty/error lists, status filtering, owner-keyed caches and inactive details.
The migration and both code generators ran against the feature Neon branch.
The owner confirmed the manual create/edit/deactivate and access-isolation checks
passed. Asset creation's estate lock is covered by `AssetControllerTests`.
Report creation is not implemented.
