# Locations API

Source of truth: `packages/api/openapi.json`. All endpoints require a signed-in
JWT subject. Estate and location IDs are UUIDs.

| Method | Path | Request | Success | Access |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/locations` | Optional query `includeInactive: boolean`, default false | 200 `LocationResponse[]` | Owner or current management member/responder for active rows; owner or MANAGER/CREW responder with `includeInactive=true` |
| POST | `/estates/{estateId}/locations` | `CreateLocationRequest` | 201 `LocationResponse`, Location header | Owner or assigned MANAGER, active estate |
| PATCH | `/estates/{estateId}/locations/{id}` | `UpdateLocationRequest` | 200 `LocationResponse` | Owner, active estate/location |
| POST | `/estates/{estateId}/locations/{id}/deactivate` | none | 200 `LocationResponse` | Owner, active estate |
| POST | `/estates/{estateId}/locations/{blockId}/floors` | `AddFloorsRequest` | 200 `AddFloorsResponse` | Owner, active estate and block |

Invited members must accept before reading. Removing membership immediately
denies subsequent reads. Invitation delegation does not confer location-write
permission. Reads list active locations, including on an inactive estate.
Owners and current Managers assigned to the target estate can create blocks,
levels and common areas. Council/legacy MEMBER/Crew/Resident/unassigned users
cannot create; being a Manager in another estate grants no creation authority.
Location editing/deactivation remain owner-only. The UI uses that estate's
`canManageEstate` capability for creation, independently of ownership controls.

Creation locks the estate before checking current ownership/Manager membership
and active status, serializing against member removal/demotion, ownership
transfer and deactivation. Subsequent requests use current membership with the
same token. After transfer, the former owner retains creation access through
their MANAGER membership; only the current owner can transfer ownership or
deactivate the estate. No creation is allowed in inactive estates (409).

Owners and current MANAGER/CREW responders can use `includeInactive=true` to
include deactivated locations for historical assets/reports. Other members
cannot use that option (404). Crew's supporting reads do not grant management
estate, asset, location or device writes. Inactive-estate reads are allowed.

## DTOs

- `CreateLocationRequest`: `type: BLOCK | LEVEL | COMMON_AREA`, `name: string`
  (trimmed, nonblank, maximum 200), `parentId: UUID | null`,
  `sortOrder: integer | null`.
- `UpdateLocationRequest`: `name: string` (same validation),
  `parentId: UUID | null`, `sortOrder: integer | null`. Replaces editable fields;
  the location type cannot change.
- `LocationResponse`: `id: UUID`, `type: BLOCK | LEVEL | COMMON_AREA`,
  `name: string`, `parentId: UUID | null`, `sortOrder: integer | null`,
  `createdAt: ISO datetime`, `updatedAt: ISO datetime`,
  `deactivatedAt: ISO datetime | null`.
- `AddFloorsRequest`: `lowestFloor: integer`, `highestFloor: integer`, both
  required and non-zero. Floors have no 0: B2 = -2, B1 = -1, L1 = 1. At most 50
  floors per request, counting without 0 (B25 to L25 is 50).
- `AddFloorsResponse`: `created: LocationResponse[]` (new `LEVEL` rows under the
  block, highest floor first, named `L<n>` / `B<n>` with `sortOrder` = floor),
  `skipped: string[]` (names of floors the block already had, highest first).
- Application errors: `{ message: string }` (`EstateError`). Security-filter
  errors may omit the JSON body.

Blocks have no parent; levels require a block and an integer position; common
areas require a block or level. Only levels have positions. Sibling names and
level positions must be unique. Deactivate active children before their parent.
Repeated deactivation is idempotent; deactivated locations remain stored.

Bulk floors skip a floor when an active level in the block already has its
position or its name (case-insensitive); deactivated levels do not count. All
of one request's levels are created in one transaction. If every floor already
exists the response is 200 with an empty `created`. 400 messages: "There is no
floor 0. B1 sits directly below L1.", "The lowest floor must not be above the
highest floor.", "Add at most 50 floors at a time.", "Floors can only be added
to a block." A deactivated block is 409.

## Status codes and example

400: invalid body/UUID/hierarchy; 401: unsigned caller; 404: inaccessible estate,
missing location/parent, a caller without owner/target-estate Manager authority attempting creation,
a non-owner attempting location editing/deactivation, or a caller without owner/responder authority requesting historical locations; 409: duplicate name
or position, inactive estate/location, or active children preventing deactivation.

Example: an authenticated owner or assigned Manager sends POST `/estates/{estateId}/locations` with
`{"type":"BLOCK","name":"Block A"}`. The 201 response contains the new
`LocationResponse`. POST `/estates/{estateId}/locations/{blockId}/floors` with
`{"lowestFloor":-2,"highestFloor":3}` creates L3, L2, L1, B1 and B2. After accepting an invitation, a member can GET the same
collection and see Block A. Only an accepted MANAGER membership additionally
permits creation; other membership roles cannot create. Editing/deactivation
still require ownership.

A resident membership in the target estate returns 403 on management requests, including a conflicting owner/RESIDENT row. Management access in another estate does not change this restriction. Unrelated estates retain 404.
