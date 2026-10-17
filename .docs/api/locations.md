# Locations API

Source of truth: `packages/api/openapi.json`. All endpoints require a signed-in
JWT subject. Estate and location IDs are UUIDs.

| Method | Path | Request | Success | Access |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/locations` | Optional query `includeInactive: boolean`, default false | 200 `LocationResponse[]` | Owner or current estate member for active rows; owner only with `includeInactive=true` |
| POST | `/estates/{estateId}/locations` | `CreateLocationRequest` | 201 `LocationResponse`, Location header | Owner, active estate |
| PATCH | `/estates/{estateId}/locations/{id}` | `UpdateLocationRequest` | 200 `LocationResponse` | Owner, active estate/location |
| POST | `/estates/{estateId}/locations/{id}/deactivate` | none | 200 `LocationResponse` | Owner, active estate |

Invited members must accept before reading. Removing membership immediately
denies subsequent reads. Invitation delegation does not confer location-write
permission. Reads list active locations, including on an inactive estate.
Owners can use `includeInactive=true` to include deactivated locations when
browsing historical asset records. Members cannot use that option (404).

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
- Application errors: `{ message: string }` (`EstateError`). Security-filter
  errors may omit the JSON body.

Blocks have no parent; levels require a block and an integer position; common
areas require a block or level. Only levels have positions. Sibling names and
level positions must be unique. Deactivate active children before their parent.
Repeated deactivation is idempotent; deactivated locations remain stored.

## Status codes and example

400: invalid body/UUID/hierarchy; 401: unsigned caller; 404: inaccessible estate,
missing location/parent, or non-owner attempting a write/historical-location read; 409: duplicate name
or position, inactive estate/location, or active children preventing deactivation.

Example: an authenticated owner sends POST `/estates/{estateId}/locations` with
`{"type":"BLOCK","name":"Block A"}`. The 201 response contains the new
`LocationResponse`. After accepting an invitation, a member can GET the same
collection and see Block A, but cannot create, update or deactivate locations.

A resident membership in the target estate returns 403 on management requests, including a conflicting owner/RESIDENT row. Management access in another estate does not change this restriction. Unrelated estates retain 404.
