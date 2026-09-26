# Estate management

**Status:** built; asset/report creation enforcement deferred

## Problem

Signed-in users need to represent the properties they manage and retire properties
without destroying their history.

## Behaviour

- Any signed-in user can create an estate and becomes its sole owner, from the JWT subject.
- Lists and detail/edit/deactivation requests are scoped to that owner; another owner's ID returns 404.
- Name, code, address and postal code are required. Description is optional.
- Details are trimmed; codes are uppercase and globally unique, including inactive estates.
- Owners can edit identifying details of active and inactive estates without changing ownership or status.
- Lists default to active, with inactive and all filters.
- Deactivation requires exact entry of the current estate code, checked in both UI and API.
- Deactivation preserves the row and timestamps its inactive state; repeating it preserves that timestamp.
- Missing authentication is rejected even if the API is running in its open local mode.

## Data

Prisma `Estate`: UUID ID, WorkOS owner ID, identifying details, created/updated
and nullable deactivated timestamps. A unique code index and owner index support
validation and scoped queries. jOOQ sources are generated from the migrated Neon branch.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates | status=ACTIVE/INACTIVE/ALL | EstateResponse[] | Owner |
| GET | /estates/{id} | UUID | EstateResponse | Owner |
| POST | /estates | EstateRequest | 201 EstateResponse | Signed in |
| PATCH | /estates/{id} | Full identifying details | EstateResponse | Owner |
| POST | /estates/{id}/deactivate | Current code | EstateResponse | Owner |

## Edge cases

- Validation failures are 400; duplicate codes are 409 without leaking SQL.
- Names may repeat. An inactive estate continues reserving its code.
- Edit and deactivation lock the owned row in a transaction, so confirmation uses
  the current code and edits cannot accidentally reactivate an estate.
- UI keeps entered data on failure and prevents repeated pending submissions.
- Query keys include the signed-in user ID so cached estate data is not shared between users.

## Out of scope

Manager memberships, invitations, ownership transfer, deletion and reactivation.
Asset/report creation does not exist yet. The acceptance criterion blocking new
assets/reports remains pending: those future transactions must lock the estate
row, check its active state, and insert the child record in the same transaction.

## Verification

HTTP tests cover owner assignment, normalization, validation, duplicate errors,
owner isolation, inactive editing and deactivation confirmation/idempotency.
UI tests cover forms, failure recovery, exact-code confirmation/cancellation,
empty/error lists, status filtering, owner-keyed caches and inactive details.
The migration and both code generators ran against the feature Neon branch.
The owner confirmed the manual create/edit/deactivate and access-isolation checks
passed. Database concurrency remains unverified; asset/report creation is not
implemented.
