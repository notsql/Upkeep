# Work orders (ID-36, independent ID-38 and ID-40)

Source of truth: `packages/api/openapi.json`. Implementation:
`com.proj.server.workorder`; Prisma model `WorkOrder`.

## Authorization and persistence

Identity is required even without a configured JWT issuer. Current estate owners
and MANAGER members create; owners, MANAGER and CREW members read all orders in
that estate. Same-estate RESIDENT membership overrides ownership. Other known
members receive 403; foreign/missing estates and related records receive 404.
WorkOS role claims do not grant estate authority.

Creation locks the estate row before checking current ownership, membership,
active state, location, asset and source placement. Membership/estate/location/
asset lifecycle writes use the same estate-first serialization. References use
`<current estate code>-W0001`, counting existing orders under that lock, growing
past four digits. Code changes never renumber saved orders. There is no delete, general order edit or assignment endpoint. Closed outcome
corrections use the dedicated operation below. Initial status is OPEN; progress/closure are described below.

Assets are optional for every category. A newly linked asset must have exactly the
same location ID as the work order; mismatches return 400 without saving. Existing
orders remain readable even if their asset subsequently moves. Linked assets and their location
ancestors must be active; retired assets cannot be linked. All related records
have composite estate foreign keys. Multiple orders may reference one report.
Report conversion does not mutate report fields, status, images or timestamps.
It also requires current MANAGER/CREW responder membership; ownership alone is
insufficient. The observed report location is checked under the estate lock,
independently of the chosen work location. Source references for inspections and
recommendations are manually entered; saved inspection integration is deferred.

## Endpoints

Every success response uses `Cache-Control: private, no-store`.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/estates/{estateId}/work-orders` | CreateWorkOrderRequest JSON | 201 WorkOrderResponse; Location header points to saved detail |
| GET | `/estates/{estateId}/work-orders` | priority?: LOW/MEDIUM/HIGH/URGENT; status?: OPEN/ASSIGNED/IN_PROGRESS/CLOSED; category?: EQUIPMENT_FAULT/CLEANLINESS/SAFETY; q?: string, max 200; sortBy?: CREATED_AT/REFERENCE/CATEGORY/PRIORITY (default CREATED_AT); direction?: ASC/DESC (default DESC); cursor?: string; limit?: integer, default 20, 1–50 | 200 WorkOrderPageResponse |
| GET | `/estates/{estateId}/work-orders/{workOrderId}` | UUID path IDs | 200 WorkOrderResponse |
| GET | `/estates/{estateId}/work-order-assets` | q?: string, max 200; cursor?: string; limit?: integer, default 20, 1–50 | 200 WorkOrderAssetPageResponse |

Creation and the limited asset picker require active estate creation authority.
The picker returns active equipment with active locations/ancestors, searches
name/reference literally and ignores provider-admin claims. It does not widen
owner-only asset APIs. List/detail reads retain inactive estate/asset history.

Errors use EstateError `{ message: string }`: 400 invalid body, enums, source
combination, cursor or limit; 401 missing identity; 403 insufficient known
membership; 404 missing/inaccessible estate or related ID; 409 inactive estate,
location/ancestor/asset, retired asset or changed source location. JWT filter
rejections use the existing security response. Unsupported methods remain denied.

## DTOs

- Category: EQUIPMENT_FAULT | CLEANLINESS | SAFETY.
- Priority: LOW | MEDIUM | HIGH | URGENT; SAFETY must be URGENT.
- Source: MANUAL | RESIDENT_REPORT | INSPECTION | MAINTENANCE_RECOMMENDATION.
- Status: OPEN | ASSIGNED | IN_PROGRESS | CLOSED.

CreateWorkOrderRequest fields: description: string (trimmed, 1–2500);
locationId: UUID; assetId?: UUID; category: Category; priority: Priority;
source: Source; sourceReportId?: UUID; sourceReference?: string (trimmed, max 500);
expectedSourceLocationId?: UUID. Report sources require both report ID and
observed location; other sources reject either field. Inspection/recommendation
sources require nonblank sourceReference.

WorkOrderResponse fields: id/estateId/locationId: UUID; reference/description/
locationPath: string; assetId: UUID or null; assetReference: string or null;
category: Category; priority: Priority; source: Source; sourceReportId: UUID or
null; sourceReference: string or null; status: Status; version: integer;
completion: WorkOrderCompletionResponse or null; createdByUserId: string;
createdByName: string or null (current account display name, resolved on POST
and detail GET after authorization, outside creation locks). List responses do
not resolve names per row. The stored createdByUserId remains the audit identity.
Unavailable account names do not prevent creation or history reads.
createdAt/updatedAt: date-time. Optional nullable values follow the generated
contract's optional field representation.

WorkOrderPageResponse: items: WorkOrderResponse[]; nextCursor: string or null.
Default ordering is createdAt then ID, both descending. Optional ordering uses
the numeric W reference sequence, category, priority rank (Low < Medium < High <
Urgent), or creation timestamp. Priority ties use creation time ascending, then
ID descending in both priority directions. Other equal sort keys use ID in the selected direction.
Reference sorting remains numeric beyond W9999 and across estate-code changes.
Ordering applies to all filtered estate records before pagination.
Opaque v3 priority cursors and v2 cursors for other sorts encode sort/direction and the last record ID; the repository
looks up that row's sort key within the authorized estate. Unknown rows, foreign
estate cursors, malformed tokens or sort/direction mismatches return 400. Old v2 priority cursors are rejected because their tie order differs. Legacy
timestamp/ID cursors remain accepted for default CREATED_AT/DESC ordering.
Unknown sorting enum values return 400. No schema change is required.
List criteria combine with AND before cursor pagination. Priority is an exact
enum match. `q` matches the stored visible reference, case-insensitively and as a
literal substring (`%`, `_` and backslashes are not search wildcards); surrounding
whitespace is trimmed and blank means no search. Unknown priorities and queries
longer than 200 characters return 400. Estate scope and membership authorization
apply to filtered requests. No matching records return an empty 200 page.

Example: `GET /estates/<estate-uuid>/work-orders?priority=HIGH&q=MG-W0001`.

WorkOrderAssetOptionResponse: id/locationId: UUID; reference/name/locationPath:
string. WorkOrderAssetPageResponse: items: WorkOrderAssetOptionResponse[];
nextCursor: string or null. Order by reference then ID ascending; cursor
encodes both values. The asset picker does not expose assignments. Provider filtering awaits ID-37.

GET `/access/context` adds canViewWorkOrders: boolean (owner/Manager/Crew,
including inactive history) and canCreateWorkOrders: boolean (active
owner/Manager) to every EstateAccessResponse. See [access.md](access.md).

Example POST:

```json
{
  "description": "Water pooling beside the bin centre.",
  "locationId": "123e4567-e89b-42d3-a456-426614174000",
  "category": "CLEANLINESS",
  "priority": "MEDIUM",
  "source": "MANUAL"
}
```

## Migration and generation

`20261022054000_create_work_orders` is additive: table, estate/reference uniqueness,
estate/time/ID index and composite report relation key. Prisma generated its SQL;
Prisma Client and jOOQ were regenerated against disposable migrated Postgres.
The migration was applied to the matched Infisical development database on
2026-10-22. Other environments must apply it before exercising the UI.
Never reset shared data. Existing deployed code can run alongside this table.

The usual `pnpm api:generate` was attempted but the local offline Maven cache
lacked springdoc-openapi-maven-plugin:1.5. The same live `/v3/api-docs` endpoint
was exported from Spring, then
`@proj/api:openapi:types` regenerated TypeScript through Nx. No dependencies
were installed.


## Progress, closure and asset outcomes

All new reads require the existing reader permission and return private/no-store.
Writes require an active owner/current Manager; a same-estate Resident overrides
ownership. Reads preserve inactive history. Writes acquire the estate and order
locks before checking the current version/state. Names are resolved before write
locks. Crew cannot update progress/completion; non-owner Managers gain no owner asset-register access.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| PATCH | `/estates/{estateId}/work-orders/{workOrderId}/status` | ChangeWorkOrderStatusRequest | 200 WorkOrderResponse |
| PUT | `/estates/{estateId}/work-orders/{workOrderId}/completion` | SaveWorkOrderCompletionRequest | 201 WorkOrderResponse; 200 identical replay |
| PATCH | `/estates/{estateId}/work-orders/{workOrderId}/completion` | CorrectWorkOrderCompletionRequest | 200 WorkOrderResponse; unchanged or identical latest retry is a no-op |
| GET | `/estates/{estateId}/work-orders/{workOrderId}/completion-revisions` | None | 200 WorkOrderCompletionRevisionResponse[], version ascending |
| GET | `/estates/{estateId}/work-orders/{workOrderId}/status-history` | None | 200 WorkOrderStatusEventResponse[] in version order |
| GET | `/estates/{estateId}/assets/{assetId}/work-order-completions` | None | 200 AssetWorkOrderCompletionResponse[], closure time/ID descending; existing owner-only asset guard |

GET work-orders additionally accepts optional status and category enum filters.
They combine with priority/reference before pagination. Omitted status includes
Closed. Assignment/provider data and assigned-provider filtering await ID-37.

ChangeWorkOrderStatusRequest: targetStatus: WorkOrderStatus (only IN_PROGRESS
accepted here); expectedVersion: required nonnegative integer. Open/Assigned can
start. Current-version same-state requests are no-ops; stale versions return 409.
Assigned/Closed/unknown targets return 400; backwards/reopen attempts return 409.

SaveWorkOrderCompletionRequest: expectedVersion: required nonnegative integer;
findings/workPerformed: required trimmed nonblank string, max 2500; partsUsed:
optional trimmed string, max 2500 (blank becomes null); labourCost/partsCost:
optional decimal strings, 1–12 whole digits and at most two fraction digits,
nonnegative; downtimeMinutes: optional integer, 0–2147483647. Costs are SGD.
Missing optional values mean unknown; explicit zero remains zero. Scientific
notation, negative/excess-precision/out-of-range values return 400.
Versions and downtime use strict JSON integer parsing: fractional numbers and
numeric strings return 400, with no silent truncation or writes.

WorkOrderCompletionResponse: id: UUID; findings/workPerformed: string; partsUsed:
string or null; labourCost/partsCost/totalCost: two-decimal string or null;
currency: string (SGD); downtimeMinutes: integer or null; completedByUserId:
string; completedByName: string or null; completedAt: date-time. Total is null
when either cost is unknown. editedByUserId/editedByName: string or null;
editedAt: date-time or null. Original completion identity, closer and time never
change; backdating and reopening remain unavailable.

WorkOrderStatusEventResponse: id: UUID; fromStatus: WorkOrderStatus or null;
toStatus: WorkOrderStatus; changedByUserId: string; changedByName: string or null;
changedAt: date-time; version: integer. New orders store an initial version-zero
Open event. Legacy creation uses the saved order ID/creator/time as a derived
version-zero entry; no migration-time event is fabricated. A new/previously
unnamed Created event uses the resolved order creator name when available,
without changing its stored authenticated identity.

AssetWorkOrderCompletionResponse: workOrderId: UUID; reference/locationPath:
string; completion: WorkOrderCompletionResponse. The saved work location survives
asset movement. Existing work can close after asset movement/retirement/
deactivation while its estate is active. Closing does not mutate asset condition,
resident reports, AssetEvent or forecasts.

Closure requires In Progress. A transaction creates the unique canonical
completion, updates Closed/version, and appends audit. An identical normalized
retry returns 200 after current authorization, even with its old version; a
changed outcome returns 409. Failures roll back all three writes. Costs/history
are read from this record rather than copied to a second ledger.

Additional EstateError 409 cases: stale version, invalid transition, already
closed with another outcome, inactive estate. Existing 400/401/403/404 semantics
apply. Missing/foreign order and asset IDs return 404.

Example closure (unknown labour, zero parts/downtime):

```json
{"expectedVersion":1,"findings":"Worn seal","workPerformed":"Replaced seal","partsCost":"0","downtimeMinutes":0}
```

`20261024050000_work_order_progress_and_completion` adds version default zero,
same-estate audit/completion relations, unique completion per order and unique
audit version. Prisma generated SQL and replayed all migrations successfully on
a disposable Postgres 18 database. Prisma deploy applied only this migration to
shared development on 2026-10-24; no reset or data backfill was used. Shared dev
also has an unrelated Device deactivation/replacement migration absent from this
branch. Its history/schema were retained. Generate this branch's jOOQ from a
clean database migrated from this branch, so unrelated Device fields are not
accidentally included in its generated sources.

The standard API export was attempted offline; springdoc's export Maven plugin
1.5 is uncached on this PC. The live Spring `/v3/api-docs` contract was exported
from an isolated API against disposable Postgres, using the normal localhost:8080
Host header, then `@proj/api:openapi:types` regenerated types via Nx. This preserves
the existing server URL and introduces only the five progress/completion paths,
the correction PATCH operation, new DTOs and
status/category parameters. The human downloaded the already-declared jOOQ
generator; the agent installed no packages.


## Audited completion corrections

PATCH completion requires the same active owner/Manager write authority as
closure; Crew read corrections through work-order detail. It accepts a complete
replacement of editable outcome fields, with `expectedVersion: integer >= 0`
and `correctionReason: string` (trimmed, nonblank, max 500). Findings/workPerformed
remain required, trimmed and max 2500. Optional `partsUsed`, `labourCost`,
`partsCost` and `downtimeMinutes` use the same validation as closure; omission or
explicit null clears a value to unknown/unrecorded. Explicit zero is preserved.
These nullable input types are generated in CorrectWorkOrderCompletionRequest.

WorkOrderCompletionRevisionResponse: id: UUID; fromVersion/version: integers;
correctionReason/changedByUserId: strings; changedByName: string or null;
changedAt: date-time; before/after: WorkOrderCompletionResponse snapshots. GET
completion-revisions uses the existing order reader guard, returns [] when none
exist and 404 for a foreign/missing order. All success responses are private,
no-store. Unauthenticated/known denied requests retain 401/403 behavior.

PATCH requires Closed with a completion, otherwise 409. Estate/order locks and a
required current version prevent lost updates. One transaction updates the
canonical completion and edited metadata, increments the order version, and
appends a before/after revision. Audit failure rolls back all writes. Status,
original completion ID/closer/time and status-transition history remain unchanged.
The original outcome is preserved in the first revision's before snapshot.
A current-version unchanged outcome returns 200 without a new revision. A stale
request replays only if it matches the latest correction's actor, original
version, normalized outcome and reason; otherwise 409. Authority and active
estate are rechecked before replay. Different concurrent corrections yield one
200 and one 409; identical requests share one saved revision. Closed outcomes
can be corrected after asset movement/retirement but not in an inactive estate.

Example correction clearing an unknown cost:

```json
{"expectedVersion":2,"correctionReason":"Corrected invoice entry","findings":"Worn seal","workPerformed":"Replaced seal","partsUsed":null,"labourCost":null,"partsCost":"0","downtimeMinutes":0}
```

`20261024090000_work_order_completion_corrections` adds nullable edit metadata
and WorkOrderCompletionRevision with a same-estate completion foreign key and
unique order/version. Prisma generated its SQL and replayed it on disposable
Postgres; jOOQ/Prisma and the live OpenAPI contract were regenerated. Prisma
deploy applied it to shared development on 2026-10-24, preserving the unrelated
Device migration. Read-only verification confirmed migration history and that
the live API matches the generated contract. See decision 0035.

Document associations and attachment endpoints: see
[work-order-documents.md](work-order-documents.md). Linking preserves work-order
status/version, completion outcomes and costs.

## Linked inspection source

`CreateWorkOrderRequest` additionally accepts `sourceInspectionId?: UUID`, and
`WorkOrderResponse` includes nullable `sourceInspectionId`. With that ID, source
must be INSPECTION, report source IDs are forbidden, the linked asset is required
and must match the estate's failed inspection, and `expectedSourceLocationId`
is required and must equal its current registered location. Work location must
also equal that location. The source reference is derived from inspection
date/ID; unlinked manual INSPECTION sources still require their text reference.
A duplicate conversion returns 409 identifying the existing order reference.
The unique nullable relation and estate-first transaction enforce at most one
linked order; creation failure leaves the inspection saved and awaiting work.
See [inspections](inspections.md) for the immutable result and lookup contracts.

Creation, the limited asset picker, progress, completion and corrections require
Owner/Manager authority. Crew have read-only work-order access, including orders
linked to their recorded inspections.

## Routed reports and contractor dispatch (ID-70)

See [report-routing.md](report-routing.md). ID-70 adds these hooks to this
package:

- `WorkOrderService.createFromRoutedReport(estate, report, actor, priority)`
  creates an Open `EQUIPMENT_FAULT` order from a report, under the same estate
  lock and active estate and location rules. The description is the resident's
  description verbatim. It is not transactional itself, and throws before
  writing, so routing can record a review instead.
- Automatic orders have `createdByUserId = system:report-routing`, and
  `createdByName` resolves to "Upkeep (automatic routing)" without a WorkOS
  lookup.
- `WorkOrderProgressService.assign` moves `OPEN` → `ASSIGNED` with a status
  event and a version increment, when a contractor dispatch is created. Other
  orders still reach `ASSIGNED` only through ID-37.
- `POST /estates/{estateId}/work-orders` with a report source also moves that
  report's routing from `NEEDS_REVIEW` to `WORK_ORDER`.
- `WorkOrderException` is public, so the routing controllers return its status.
- New endpoints: GET and POST `/estates/{estateId}/work-orders/{workOrderId}/dispatch`,
  and POST `…/dispatch/retry`.
