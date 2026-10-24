# Work orders (ID-36)

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
past four digits. Code changes never renumber saved orders. There is no delete,
edit, assignment or status transition endpoint. Initial status is OPEN.
The status contract is limited to OPEN in ID-36; workflow states/transitions
belong to ID-38 and closure with an outcome belongs to ID-40.

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
| GET | `/estates/{estateId}/work-orders` | priority?: LOW/MEDIUM/HIGH/URGENT; q?: string, max 200; sortBy?: CREATED_AT/REFERENCE/CATEGORY/PRIORITY (default CREATED_AT); direction?: ASC/DESC (default DESC); cursor?: string; limit?: integer, default 20, 1–50 | 200 WorkOrderPageResponse |
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
- Status: OPEN.

CreateWorkOrderRequest fields: description: string (trimmed, 1–2500);
locationId: UUID; assetId?: UUID; category: Category; priority: Priority;
source: Source; sourceReportId?: UUID; sourceReference?: string (trimmed, max 500);
expectedSourceLocationId?: UUID. Report sources require both report ID and
observed location; other sources reject either field. Inspection/recommendation
sources require nonblank sourceReference.

WorkOrderResponse fields: id/estateId/locationId: UUID; reference/description/
locationPath: string; assetId: UUID or null; assetReference: string or null;
category: Category; priority: Priority; source: Source; sourceReportId: UUID or
null; sourceReference: string or null; status: Status; createdByUserId: string;
createdByName: string or null (current account display name, resolved on POST
and detail GET after authorization, outside creation locks). List responses do
not resolve names per row. The stored createdByUserId remains the audit identity.
Unavailable account names do not prevent creation or history reads.
createdAt/updatedAt: date-time. Optional nullable values follow the generated
contract's optional field representation.

WorkOrderPageResponse: items: WorkOrderResponse[]; nextCursor: string or null.
Default ordering is createdAt then ID, both descending. Optional ordering uses
the numeric W reference sequence, category, priority rank (Low < Medium < High <
Urgent), or creation timestamp. Priority ties use creation time descending, then
ID descending in both priority directions. Other equal sort keys use ID in the selected direction.
Reference sorting remains numeric beyond W9999 and across estate-code changes.
Ordering applies to all filtered estate records before pagination.
Opaque v2 cursors encode sort/direction and the last record ID; the repository
looks up that row's sort key within the authorized estate. Unknown rows, foreign
estate cursors, malformed tokens or sort/direction mismatches return 400. Legacy
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
encodes both values. Neither page exposes assignments or status filters from ID-38.

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

