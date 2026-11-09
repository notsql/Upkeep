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

List, detail and relocation return estate-only DTOs (`EstateIssueReportPageResponse`,
`EstateIssueReportDetailResponse`): the fields below plus duplicate counts,
`duplicateOf` and, on detail, `duplicates`. See
[fault-report-duplicates.md](fault-report-duplicates.md), which also covers the
PATCH and PUT `/estates/{estateId}/reports/{reportId}/duplicate` endpoints.
Resident endpoints keep their original report DTOs unchanged.

| DTO | Fields |
| --- | --- |
| `EstateIssueReportSummaryResponse` | `id: UUID`, `title: string`, `description: string`, `estateName: string`, `location: ReportLocation`, `status: string`, `createdAt: date-time`, `updatedAt: date-time`, `urgency: LOW \| MEDIUM \| HIGH \| URGENT`, `isSafety: boolean`, `urgencyVersion: integer`, `confirmedDuplicateCount: integer`, `suspectedDuplicateCount: integer`, `duplicateOf: DuplicateOf \| null`, `routing: ReportRoutingResponse \| null` (null for reports submitted before automatic routing) |
| `ReportLocation` | `id: UUID`, `label: string` (full current path, e.g. `Block A › Level 4 › Lift lobby`) |
| `EstateIssueReportDetailResponse` | Summary fields (including `routing`) plus `images: ReportImage[]`, `duplicates: LinkedDuplicate[]`, `lastUrgencyChange: ReportUrgencyChange \| null` |
| `ReportImage` | `id: UUID`, `contentType: string` (`image/jpeg` or `image/png`) |
| `EstateIssueReportPageResponse` | `items: EstateIssueReportSummaryResponse[]`, `nextCursor: string \| null` |
| `RelocateReportRequest` | Required, non-null `locationId: UUID`, `expectedLocationId: UUID` |
| `ChangeReportUrgencyRequest` | Required, non-null `urgency: LOW \| MEDIUM \| HIGH \| URGENT`, `isSafety: boolean`, `expectedVersion: integer >= 0` |
| `ReportUrgencyChange` | `id: UUID`, `version: integer`, `fromUrgency/toUrgency: LOW \| MEDIUM \| HIGH \| URGENT`, `fromIsSafety/toIsSafety: boolean`, `changedByName: string \| null`, `changedAt: date-time` |
| `EstateError` | `message: string` |

Responses exclude submitter profiles, contact information, storage keys and
management notes. Historical titles of up to 150 characters remain readable;
new submission constraints are documented in [resident-reports.md](resident-reports.md).

## Endpoints

| Method/path | Request | Success | Other statuses |
| --- | --- | --- | --- |
| GET `/estates/{estateId}/reports` | Optional `openOnly: boolean` (default false), `sort: URGENCY \| NEWEST \| OLDEST` (default URGENCY), `locationId: UUID`, `blockId: UUID`, `minLevelPosition: int32`, `maxLevelPosition: int32`, `routingState: CLASSIFYING \| NEEDS_REVIEW \| WORK_ORDER \| DISMISSED`, `cursor: string`, `limit: integer` (1–50, default 20) | 200 `EstateIssueReportPageResponse` | 400 invalid UUID/cursor/limit/range/sort or non-block blockId; 401; 403; 404 |
| GET `/estates/{estateId}/reports/{reportId}` | UUID paths | 200 `EstateIssueReportDetailResponse` | 400; 401; 403; 404 |
| PATCH `/estates/{estateId}/reports/{reportId}/location` | JSON `RelocateReportRequest` | 200 updated `EstateIssueReportDetailResponse` (unchanged on a valid no-op) | 400 invalid UUID/body or block-only destination; 401; 403; 404; 409 |
| PATCH `/estates/{estateId}/reports/{reportId}/urgency` | JSON `ChangeReportUrgencyRequest` | 200 updated `EstateIssueReportDetailResponse` (unchanged on a valid no-op) | 400 invalid body or Safety below Urgent; 401; 403; 404; 409 stale version or inactive estate |
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
`isSafety DESC`, numeric urgency rank descending (Urgent, High, Medium, Low),
then `createdAt DESC, id DESC`. Filtering and ordering run in PostgreSQL before
pagination. `sort=NEWEST` instead orders solely by `createdAt DESC, id DESC`,
ignoring urgency and Safety. `sort=OLDEST` uses `createdAt ASC, id ASC` with an
ascending cursor comparison, also ignoring urgency/Safety. Opaque cursors include the ordering tuple and are
scoped to estate, filters and sort; old or mismatched cursors return 400 with a first-page
reload instruction. Equal timestamps use ID order. Concurrent changes can move
reports between pages; refresh from the first page for the current queue.
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
Location correction has no reason or timeline and does not change urgency/version.

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

## Urgency and Safety

Migration `20261106163436_report_urgency` adds Medium/non-Safety/version-zero
defaults to existing and new reports. Resident response DTOs and chronological
history are unchanged. Estate-only DTOs expose urgency; list responses omit audit
metadata, and detail exposes the latest change or explicit null.

Only a current same-estate MANAGER can change urgency in an active estate.
Ownership relies on the MANAGER membership invariant. CREW and custom
VIEW_FAULT_REPORTS readers see urgency and the latest change without edit rights.
`canChangeFaultReportUrgency` reflects this policy; no new custom grant is added.

Safety requires Urgent. Removing Safety leaves urgency unchanged unless the
request explicitly changes it. The service resolves an optional actor-name
snapshot before taking locks, then locks estate before membership and rechecks
activity/authority. Each real edit updates urgency, Safety, version and updatedAt
and appends an `IssueReportUrgencyEvent` in one Spring transaction using typed
jOOQ. Every event retains the authenticated subject privately. An unavailable
name does not block a change; the public change DTO never exposes account IDs.

`expectedVersion` must match even for a no-op. A stale/changed-back version
returns 409 without writes. A valid no-op preserves version, updatedAt and audit
rows. Location corrections and work-order priorities remain independent.

`openOnly=true` includes reports with no same-estate source work orders or at
least one source work order whose status is not CLOSED. All-closed reports are
excluded. The query uses `WorkOrderStatus.CLOSED`, and urgency write authorization
uses `EstateRole.MANAGER`. The API defaults to all reports so existing source
pickers retain history; the estate queue UI explicitly requests Open. No report
lifecycle or routing/dismissal schema is introduced by this feature.

Example:

```text
PATCH /estates/<estate-uuid>/reports/<report-uuid>/urgency
Content-Type: application/json

{"urgency":"URGENT","isSafety":true,"expectedVersion":0}
```

The response has `urgencyVersion: 1` and `lastUrgencyChange` with previous/new
values, actor name (or null) and server time. Subsequent detail reads expose only
the latest event; all events remain stored. There is no history endpoint.

Urgency updates return the combined estate detail, preserving duplicate links and
counts. Duplicate decisions, manual links and relocation return the same DTO
with current urgency/version/latest-change metadata. Sorting never changes saved
urgency or work-order priority.

## Routing (ID-70)

The estate DTOs are separate from the resident `IssueReport*Response` types, so
`routing` never reaches residents. `routingState` filters before pagination and is part of the cursor scope,
and reports without routing never match it. Relocation does not reclassify a
report or change its work order. See [report-routing.md](report-routing.md).
