# Estates

Source of truth: `packages/api/openapi.json`. Every endpoint requires an
authenticated JWT subject, including local development. Ownership is the current
`Estate.ownerUserId`; Manager authority comes from current membership in that
specific estate, never provider claims or membership in another estate.

| Method | Path | Request | Success | Authority |
| --- | --- | --- | --- | --- |
| GET | `/estates` | Optional `status: ACTIVE \| INACTIVE \| ALL`, default ACTIVE | 200 EstateResponse[] | Lists estates owned or assigned as MANAGER/COUNCIL/legacy MEMBER or CUSTOM with VIEW_ESTATE; excludes RESIDENT/CREW |
| GET | `/estates/{id}` | `id: UUID` | 200 EstateResponse | Owner or assigned MANAGER/COUNCIL/legacy MEMBER or custom VIEW_ESTATE |
| POST | `/estates` | EstateRequest | 201 EstateResponse; Location `/estates/{id}` | Any authenticated subject; creation atomically records ownership and MANAGER membership |
| PATCH | `/estates/{id}` | EstateRequest | 200 EstateResponse | Current owner, assigned MANAGER or custom EDIT_ESTATE in this estate |
| POST | `/estates/{id}/deactivate` | DeactivateEstateRequest | 200 EstateResponse | Current owner only |

## DTOs

- EstateRequest: `name: string` (required, max 200), `code: string` (required,
  max 50), `address: string` (required, max 500), `postalCode: string` (required,
  max 20), `description?: string | null` (max 2000). Required strings are
  nonblank. Strings are trimmed; code is uppercase and globally unique across
  active/inactive estates. This request cannot change ownership or activation.
- DeactivateEstateRequest: `code: string`, required/nonblank, max 50; must match
  the current stored estate code exactly.
- EstateResponse: `id: UUID`; `name/code/address/postalCode: string`;
  `description: string | null`; `createdAt/updatedAt: datetime`;
  `deactivatedAt: datetime | null`;
  `owned/canInviteMembers/canManageInvitationPermissions: boolean`. `owned`
  identifies only the current owner, including when a Manager edits details.
  Editing permission uses `canManageEstate` from `/access/context`, not the
  invitation flags. See [access.md](access.md).
- EstateError: `message: string`.

## Permission and lifecycle rules

Any signed-in account can create an estate, including unassigned, Resident, Crew,
Council and legacy Member accounts. The JWT subject becomes owner and MANAGER in
that new estate. The request cannot choose another owner or role. This grants no
authority over existing estates and preserves other memberships and invitations.
`GET /estates` can return an empty list to Resident/Crew/unassigned accounts.
No database migration or global Manager grant is involved.

Council, legacy MEMBER, Crew, Resident and unassigned users cannot edit details.
Council/Member receive 403; inaccessible estates (including Crew-only and
unassigned callers) return 404. Resident membership explicitly denies management
access with 403. A Manager assigned only to a different estate receives 404.

Editing locks the estate before checking current Manager/owner/custom EDIT_ESTATE authority and
uses the same permission condition in the update. Member removal/demotion and
ownership transfer serialize on that estate row. The next edit request reflects
current membership even with the same token. Active/inactive details are
editable; editing preserves `ownerUserId` and `deactivatedAt`.

Only the current owner can transfer ownership or deactivate. Transfer retains
the former owner's MANAGER membership, so they can still edit but cannot
deactivate or transfer again. See [council-invitations.md](council-invitations.md).
Deactivation preserves history and sets `deactivatedAt`; repeating it preserves
the original timestamp. Exact-code confirmation uses the current code under lock.

Errors: 400 invalid details/code confirmation/UUID/status; 401 missing identity;
403 insufficient authority for a visible estate or Resident management access;
404 missing/inaccessible estate; 409 duplicate code; 503 storage
unavailable. Errors use EstateError (the security filter may return an empty
401/403 before the controller).

Creation example: an unassigned subject posts
`{"name":"Maple Grove","code":"MG-001","address":"1 Grove Road","postalCode":"123456"}`
to `/estates`. The 201 response has `owned:true`; refreshed `/access/context`
includes MANAGER capabilities for that estate. Missing/blank identity returns
401, invalid details 400 and a duplicate code 409, including inactive estate codes.

Example: an assigned Manager sends `PATCH /estates/{id}` with
`{"name":"Maple Grove","code":"MG-001","address":"1 Grove Road","postalCode":"123456","description":null}`.
The 200 response contains these details, timestamps and estate ID, with
`owned:false`. The same Manager's `POST /estates/{id}/deactivate` with
`{"code":"MG-001"}` returns 403.

Custom roles use current [estate permissions](estate-roles.md). VIEW_ESTATE
adds estate list/detail visibility and active location context; EDIT_ESTATE permits
detail editing, including inactive estates. A known custom member without the
required permission receives403. Neither grant allows location creation/editing,
member administration, assets, ownership transfer or estate deactivation. Queries
and writes use the same typed permission predicates; same-token reassignment or
definition editing affects the next request. Invitation response flags include
custom INVITE_MEMBERS for sending; legacy member administration remains Manager-only.
