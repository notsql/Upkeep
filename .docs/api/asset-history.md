# Asset history API

Source of truth: `packages/api/openapi.json`. Implementation:
`com.proj.server.assethistory`. These reads project existing tables, without
creating an event store, copying files, recording invoice costs or running inference.

## Authority and errors

Authenticated current estate Owners and same-estate `COUNCIL` members may read.
A same-estate Resident membership overrides ownership. Manager, Crew, legacy
Member and custom document grants do not independently grant history. The live
`/access/context` field `canViewAssetHistory: boolean` is separate from unchanged
owner-only `canViewAssets`. Every page rechecks authority. Retired assets and
inactive estates retain reads.

Every response is `Cache-Control: private, no-store`. Errors use
`EstateError { message: string }`: 400 invalid paths/filters/cursor/limit,
401 missing identity, 403 denied authority, 404 inaccessible/missing estate or
missing/foreign asset, 500 source read failure. A source failure never returns
partial history. There are no history writes.

## GET `/estates/{estateId}/asset-history`

`estateId: UUID`. Query: `q?: string` (trimmed, maximum 255 characters),
`status?: ACTIVE | INACTIVE | ALL` (default ALL), opaque `cursor?: string`,
`limit?: integer` (default 25, inclusive range 1–100).

200 `AssetHistoryAssetPageResponse` has `items: AssetHistorySummaryResponse[]`
and `nextCursor: string | null`. Search matches literal case-insensitive
reference/name substrings; `%`, `_` and backslash are escaped by jOOQ. Blank search
matches all. Search/status apply before paging. INACTIVE selects retired assets.
Order: reference ascending, then UUID ascending. Versioned cursors bind estate,
normalized query and status to the last reference/UUID. Mismatched cursors fail 400.

`AssetHistorySummaryResponse` fields: `id: UUID`; `reference`, `name`,
`category`, `locationPath: string`; `installedOn`, `retiredOn: date | null`;
`status: ACTIVE | RETIRED`. Category is the stored code.

Example: `GET /estates/{estateId}/asset-history?q=pump&status=ALL&limit=25`
returns `{"items":[{"id":"00000000-0000-0000-0000-000000000001","reference":"E-A0001","name":"Water pump","category":"PUMP","locationPath":"Block A","installedOn":null,"retiredOn":null,"status":"ACTIVE"}],"nextCursor":null}`.

## GET `/estates/{estateId}/assets/{assetId}/history`

UUID path parameters. Query: opaque `cursor?: string`, `limit?: integer`
(default 25, range 1–100), optional `from: date` and `to: date` in strict
`YYYY-MM-DD` format (years 0001–9999). Both bounds include their entire Singapore
calendar day; an omitted bound is unbounded. Explicitly empty, malformed or
impossible dates and From after To return 400 with the existing private error
envelope. Filtering uses occurrence time, including original document upload and
canonical completion time, before pagination. 200 `AssetHistoryPageResponse` fields:

| Field | Type |
| --- | --- |
| asset | AssetHistorySummaryResponse |
| items | AssetHistoryEntryResponse[] |
| nextCursor | string or null |
| documentsVisible | boolean; false means denied document access, rather than no attachments |

Every entry has `id: string` (`kind:sourceId`), `sourceId: UUID`,
`kind: MAINTENANCE | WORK_ORDER_COMPLETED | CONDITION | INSPECTION | LIFECYCLE | INVOICE | SERVICE_REPORT`,
`title: string`, `summary: string | null`, `occurredOn: date | null`,
`occurredAt: datetime | null`, `recordedAt: datetime`, `details: AssetHistoryDetails`.
Exactly one occurrence field is non-null. `details` is a real record union with
an explicit `kind` discriminator:

| Entry | Details discriminator and fields |
| --- | --- |
| MAINTENANCE | MAINTENANCE: `type`, `notes: string`; nullable `findings`, `workPerformed`, `serviceProvider`, `partsReplaced`, `labourCost`, `partsCost`, `otherCost`, `totalCost: string`, `downtimeMinutes: integer` |
| WORK_ORDER_COMPLETED | COMPLETION: `workOrderId: UUID`, `reference`, `findings`, `workPerformed`, `currency: string`, `canViewWorkOrder: boolean`; nullable `partsUsed`, `labourCost`, `partsCost`, `totalCost: string`, `downtimeMinutes: integer`, `editedAt: datetime` |
| CONDITION | CONDITION: `condition: string`, `assessedOn: date`, `notes: string`, `origin: HUMAN | ANOMALY_MODEL`, `sourceLabel: string` |
| INSPECTION | INSPECTION: `outcome: string`, `inspectedOn: date`, `locationPath: string`, `canViewInspection: boolean`, nullable `notes: string` |
| LIFECYCLE | LIFECYCLE: `action: string`, `lifecycleVersion: integer`; nullable `previousRetiredOn`, `retiredOn: date`, `previousRetirementReason`, `retirementReason: string` |
| INVOICE / SERVICE_REPORT | DOCUMENT: `document: DocumentResponse` |

`DocumentResponse`: `id`, `estateId: UUID`, `documentType: INVOICE | SERVICE_REPORT`,
`originalFilename`, `contentType: string`, `sizeBytes: integer`, `createdAt: datetime`,
`canDelete: boolean` (false in this read-only projection). No raw actor subjects,
storage keys, file bytes or storage URLs are returned.

Date-only sources retain their original precision, comparing at Singapore midnight.
Order is occurrence descending, then kind text and source UUID descending. Versioned
cursors (`history-v2`) bind the complete ordering key to estate/asset and both
date bounds. Changed/cleared bounds and legacy v1 cursors fail 400; request a fresh
first page. New/backdated writes appear
on refresh; separate pages are not an immutable snapshot. Only recorded activity
appears; installation summary fields do not invent installation events.

Completions use the canonical completion UUID and original completion time;
corrections show current outcome and edited time. Manual records remain separate.
The completion endpoint closes orders with status `CLOSED`; the projection uses
`WorkOrderStatus.CLOSED` and requires a saved completion record. `WORK_ORDER_COMPLETED`
is the timeline kind, not a work-order status. An order with no linked asset does
not contribute to an asset's history merely because its location matches.
Unknown costs/downtime remain null, distinct from zero. Existing model assessments
have source label Anomaly detection; this is provenance, not prediction history.
Source-detail link flags require independent source-screen access (Owner true,
Council false under the current policy).

Documents are the UUID-deduplicated union of non-deleted direct links and links
through same-estate work orders for this asset, before page limits. They use original
upload time and titles `Invoice uploaded` / `Service report uploaded`. Link audits
do not add events. Either path retains eligibility; loss of both or deletion removes
the event on refresh. Document entries require current `VIEW_DOCUMENTS`.

Example: `GET /estates/{estateId}/assets/{assetId}/history?limit=25` returns the
summary above with `items` of mixed entries, a continuation cursor or null, and
`documentsVisible`. An invoice entry has `kind: INVOICE`, `details.kind: DOCUMENT`,
its document UUID as `sourceId`, null `occurredOn`, and upload timestamp `occurredAt`.
Open its file via authenticated GET
`/estates/{estateId}/documents/{documentId}/content`; current content authority and
existing 404/503 semantics are preserved. See [documents.md](documents.md).
Storage outages affect content reads, not timeline metadata.

Date example: `GET /estates/{estateId}/assets/{assetId}/history?from=2026-03-01&to=2026-03-31`
includes occurrences at/after `2026-03-01T00:00:00+08:00` and before
`2026-04-01T00:00:00+08:00`. An empty range still returns the asset summary,
document visibility, empty items and a null continuation cursor.

## Projection and generation

Typed jOOQ UNION ALL selects only time/kind/UUID keys. A single OR/EXISTS document
predicate prevents dual-link duplicates. Inclusive From and exclusive day-after-To
conditions apply to the combined occurrence key in Singapore time. The range,
combined cursor, ordering and
`limit + 1` apply in SQL, then selected records are hydrated through bounded typed
queries. Authority, summary, keys and details share a read-only repeatable-read
transaction. No schema change or new index is introduced.

`AssetHistoryOpenApiConfiguration` flattens springdoc's circular subtype inheritance
and sets discriminator literals. Run `pnpm api:generate`; do not hand-edit generated
schemas or TypeScript.
