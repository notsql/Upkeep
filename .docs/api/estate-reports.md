# Estate fault reports API

Source of truth: `packages/api/openapi.json`. Every operation requires a JWT
subject, including local development without a configured issuer. Authority is
current `EstateUser` MANAGER/CREW membership or custom VIEW_FAULT_REPORTS in the requested estate. Ownership
alone, WorkOS claims, Council, Member and Resident roles do not grant responder
access. Revocation applies to the next request with the same token. Resident
own-history URLs retain submitter-only authorization.
Estate creation records owner MANAGER membership. Migration
`20261022135000_backfill_estate_owner_memberships` repairs that invariant for
existing owners with missing or legacy nonresident memberships, so their report
access matches new estates. It preserves owner/RESIDENT conflicts and all
non-owner assignments; report authorization still checks current membership.

## DTOs

| DTO | Fields |
| --- | --- |
| `EstateReportSummaryResponse` | `id: UUID`, `title: string`, `description: string`, `estateName: string`, `location: ReportLocation`, `status: string`, `createdAt: date-time`, `updatedAt: date-time`, `routing: ReportRoutingResponse \| null` (null for reports from before ID-70; see [report-routing.md](report-routing.md)) |
| `ReportLocation` | `id: UUID`, `label: string` (full current path, e.g. `Block A › Level 4 › Lift lobby`) |
| `EstateReportDetailResponse` | Summary fields (including `routing`) plus `images: ReportImage[]` |
| `ReportImage` | `id: UUID`, `contentType: string` (`image/jpeg` or `image/png`) |
| `EstateReportPageResponse` | `items: EstateReportSummaryResponse[]`, `nextCursor: string \| null` |
| `RelocateReportRequest` | Required, non-null `locationId: UUID`, `expectedLocationId: UUID` |
| `EstateError` | `message: string` |

Responses exclude submitter profiles, contact information, storage keys and
management notes. Historical titles of up to 150 characters remain readable;
new submission constraints are documented in [resident-reports.md](resident-reports.md).

## Endpoints

| Method/path | Request | Success | Other statuses |
| --- | --- | --- | --- |
| GET `/estates/{estateId}/reports` | Optional `locationId: UUID`, `blockId: UUID`, `minLevelPosition: int32`, `maxLevelPosition: int32`, `routingState: CLASSIFYING \| NEEDS_REVIEW \| WORK_ORDER \| DISMISSED`, `cursor: string`, `limit: integer` (1–50, default 20) | 200 `EstateReportPageResponse` | 400 invalid UUID/cursor/limit/range/routing state or non-block blockId; 401; 403; 404 |
| GET `/estates/{estateId}/reports/{reportId}` | UUID paths | 200 `EstateReportDetailResponse` | 400; 401; 403; 404 |
| PATCH `/estates/{estateId}/reports/{reportId}/location` | JSON `RelocateReportRequest` | 200 updated `EstateReportDetailResponse` (unchanged on a valid no-op) | 400 invalid UUID/body or block-only destination; 401; 403; 404; 409 |
| GET `/estates/{estateId}/reports/{reportId}/images/{imageId}` | UUID paths | 200 private JPEG/PNG bytes with the stored content type | 400; 401; 403; 404; 503 storage unavailable |

403 means known estate access without responder authority, including conflicting
owner/Resident membership. 404 hides inaccessible/missing estates, reports outside
the requested estate, unknown/foreign location nodes and images outside that
report. Read and image access survives estate/location deactivation while
responder membership remains current. Responses use `Cache-Control: private,
no-store`; images remain in private storage and provider details are not exposed.

Filtering includes the selected node and every descendant by ID/parent edges,
including inactive nodes. All locations means no filter. A valid empty subtree
returns an empty 200 page. Filtering executes before pagination, ordered by
`createdAt DESC, id DESC`; cursors are opaque. Equal timestamps use ID order.
Current names/parents determine paths and filter ancestry, without snapshots.

Block filtering selects a same-estate BLOCK by ID and includes its levels and
common areas, including common areas directly beneath the block. Unknown or
foreign block IDs return 404; a same-estate level/common-area blockId returns 400.

Position bounds are optional, inclusive 32-bit integers and may be negative or
zero. Compare the LEVEL's `sortOrder`, never its name: reports on the level or a
common area beneath it match. Direct block common areas have no position and
are excluded whenever either bound is set. Without blockId, the range applies
across this estate. Either bound may be omitted; equal bounds select one
position. Reversed bounds, fractions, nonnumbers and overflow return 400.
Inactive blocks, levels and common areas retain historical matching. All supplied
locationId/blockId/position filters intersect before pagination. No schema change
or new index is required.

Example: `GET /estates/<estate-uuid>/reports?blockId=<block-uuid>&minLevelPosition=-1&maxLevelPosition=4`
returns basement through position 4 within that block, regardless of level names.

Custom relocation additionally requires RELOCATE_FAULT_REPORTS; VIEW_FAULT_REPORTS alone is read-only. Relocation stays in the original estate. Staff may change block, level and
common-area selections; the saved node is an active LEVEL or COMMON_AREA whose
ancestors are active. An inactive current placement can be corrected. The estate
is locked before membership and placement checks, serializing hierarchy edits,
deactivation, revocation and other corrections. A stale expected location or
inactive estate/destination/ancestor returns 409 and leaves the report unchanged.
If expected and destination IDs equal the valid current placement, `updatedAt`
does not change. Otherwise only `locationId` and `updatedAt` change: title,
description, status, submitter, creation time and all image metadata/bytes remain.
There is no correction reason, audit timeline, transfer or other report editing.

`EstateReportRepository` uses generated jOOQ tables for estate/membership lookups,
estate-scoped hierarchy joins and relocation updates. Optional `FOR UPDATE` locks
retain the estate-before-membership order. The update uses a typed jOOQ function
call to Postgres `clock_timestamp()` so `updatedAt` reflects the database wall
clock, including when a transaction has waited for a lock.

Service authorization takes the required permission separately from the locking
flag. Lists, details and images explicitly require VIEW_FAULT_REPORTS; relocation
explicitly requires RELOCATE_FAULT_REPORTS. Acquiring a lock does not change the
permission being checked.

Example correction:

```text
PATCH /estates/<estate-uuid>/reports/<report-uuid>/location
Content-Type: application/json

{"locationId":"<new-level-or-common-area-uuid>","expectedLocationId":"<observed-location-uuid>"}
```

Then GET `/estates/<estate-uuid>/reports?locationId=<new-block-uuid>` includes
the report under its new ancestry. Resident own-history/detail shows the same
correction, including after the submitter's membership is removed.

Supporting contracts: [access.md](access.md) includes responder capabilities and
estate labels; [locations.md](locations.md) permits responders to read inactive
hierarchy nodes without granting location writes. Migration
`20261018150454_fault_report_locations` adds the estate pagination and
estate/location pagination indexes; Prisma and jOOQ are regenerated together.

Custom report-only accounts may read reports/images and supporting historical
locations without VIEW_ESTATE or management detail/asset access. Read and
relocation permissions are independently projected by access context and checked
on each request; editing a definition or reassigning a member takes effect with
the same token. No custom grant expands other report CRUD or Resident submissions.

## Routing (ID-70)

The estate DTOs are separate from the resident `IssueReport*Response` types, so
`routing` never reaches residents. `routingState` filters before pagination,
and reports without routing never match it. Relocation does not reclassify a
report or change its work order. See [report-routing.md](report-routing.md).
