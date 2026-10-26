# Asset inspections

Implemented in `com.proj.server.inspection`. The source contract is
`packages/api/openapi.json`; migration
`20261026014754_create_inspection_results` adds two evidence tables and the
nullable, unique `WorkOrder.sourceInspectionId` relation. These are standalone
results, with no scheduled-check dependency or maintenance/condition write.

## Authority and responses

Every operation requires a JWT subject, including when the issuer is not
configured. The current estate Owner, MANAGER or CREW can read; a same-estate
RESIDENT membership overrides ownership. Other known roles get 403, unknown
or foreign relationships get 404. Independent ownership still qualifies an
Owner with another membership. Provider-admin claims confer no authority.

Recording additionally requires an active estate, active/unretired asset and
active location ancestry. History and photos remain readable after retirement
or deactivation while estate authority remains. Revocation applies even to the
inspector's own submissions. Every successful response has
`Cache-Control: private, no-store`; errors have the same cache policy.

Paths below have base `/estates/{estateId}`, where all path IDs are UUIDs.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/inspection-assets` | Optional `q: string` (maximum 200), `cursor: string`, `limit: integer` (default 20, 1–50) | 200 `InspectionAssetPageResponse` |
| GET | `/inspection-assets/{assetId}` | Path IDs | 200 `InspectionAssetResponse` |
| POST | `/assets/{assetId}/inspections` | Multipart `CreateInspectionRequest` | 201 `InspectionResultResponse`; `Location` is its nested detail path |
| GET | `/assets/{assetId}/inspections` | Optional `cursor: string`, `limit: integer` (default 20, 1–50) | 200 `InspectionResultPageResponse` |
| GET | `/assets/{assetId}/inspections/{inspectionId}` | Path IDs; validates the complete estate/asset/result relationship | 200 `InspectionResultResponse` |
| GET | `/inspection-results/{inspectionId}` | Estate and result IDs | 200 `InspectionResultResponse`; authorised source lookup for the work-order conversion URL |
| GET | `/assets/{assetId}/inspections/{inspectionId}/photos/{photoId}` | Full relationship checked before storage reads | 200 private JPEG/PNG bytes, validated `Content-Type`, `X-Content-Type-Options: nosniff` |

No result/photo update or deletion endpoint exists. Unsupported methods and
nested actions are denied by the configured JWT security chain.

## DTOs

`CreateInspectionRequest`, multipart:

- `outcome: "PASS" | "FAIL"`, required; no inferred/default outcome.
- `inspectedOn: string` (ISO date), required; no later than Singapore today or
  earlier than the asset's known installation date.
- `expectedLocationId: UUID`, required; location observed when the form opened.
  A moved asset returns 409 and requires review.
- `notes?: string`; trimmed, maximum 2,000 characters after trimming; blank is
  stored as null.
- `photos?: binary[]`; repeated multipart files, at most three. Each must be
  JPEG/PNG, at most 5 MiB, maximum 4,032 by 3,024 pixels. The server checks actual
  content and dimensions and re-encodes the image before storage.

`InspectionAssetResponse` contains `id`, `estateId`, `locationId: UUID`;
`reference`, `name`, `category`, `locationPath: string`;
`installedOn: ISO date | null`; `estateActive`, `assetActive`,
`locationActive: boolean`. This is limited context, without serial numbers,
condition, costs, readings or forecasts. Listing includes historical inactive
context and searches names/references literally. It sorts by reference then ID.

`InspectionResultResponse` contains:

- `id`, `estateId`, `assetId`, `locationId: UUID`.
- `locationPath: string`, captured at recording; later moves/renames do not
  change it.
- `outcome: "PASS" | "FAIL"`, `inspectedOn: ISO date`.
- `notes: string | null`.
- `recordedByUserId: string`, derived from authentication;
  `recordedByName: string | null`, optional display-name snapshot.
- `createdAt: ISO timestamp`, set by the server.
- `photos: InspectionPhotoResponse[]`, each `{ id: UUID, contentType: string }`.
- `workOrder: InspectionWorkOrderResponse | null`, where a link contains
  `{ id: UUID, reference: string }`. OpenAPI expresses this as an explicit
  object-or-null union; generated frontend types preserve null.

Both page DTOs contain `items: <respective DTO>[]` and
`nextCursor: string | null`. Result ordering is inspection date descending,
then recording timestamp and ID descending. Cursors are opaque and bound to
the estate and, for result history, asset. Multiple results on the same date
are independent records.

Pass is closed without work-order follow-up. Fail plus null link means
**Awaiting work order**. A linked order resolves that flag; its progress or
closure never rewrites the historical Fail.

## Transactions and private evidence

Authority and input validation happen before uploads. Optional inspector-name
lookup and R2 uploads run outside the write transaction. The transaction locks
the estate first, rechecks current membership/activity/location, and writes
one result and its evidence metadata together. Failure cleans up uploaded
objects. Failed cleanup is logged, and a bounded hourly sweep retries orphan
objects older than 24 hours under the private `inspections/` prefix. Photo-free
submissions work without configured storage. Resident-report APIs cannot read
inspection evidence; no keys or public bucket URLs appear in DTOs.

## Work-order conversion

See [work-orders](work-orders.md). Its existing POST additionally accepts
`sourceInspectionId?: UUID`; `source` must be INSPECTION, `assetId` must match
the same-estate failed result, and `expectedSourceLocationId` must match the
asset's current registered location. Source IDs cannot be mixed. Linked orders
derive a source reference from the inspection date/ID; legacy unlinked
INSPECTION orders still require source text. The estate-first transaction and
unique source relation prevent concurrent duplicate conversion. A 409 for an
existing conversion identifies the saved work-order reference. Creation, the
limited work-order asset picker and progress/completion/correction require
Owner/Manager authority. Crew can record and read inspections and read linked
work orders; their conversion attempts return 403 without changing the result.

## Errors and example

Errors use `EstateError { message: string }`: 400 invalid fields/content/cursor,
401 missing identity, 403 insufficient known authority, 404 inaccessible/missing
related data, 409 inactive resources or stale placement, 413 file too large,
415 unsupported media, and 503 unavailable evidence/persistence. Storage/SQL
provider details are not returned.

```bash
curl -H 'Authorization: Bearer <token>' \
  -F outcome=FAIL -F inspectedOn=2026-10-26 \
  -F 'expectedLocationId=<location-uuid>' -F notes='Cracked seal' \
  -F 'photos=@seal.png;type=image/png' \
  'https://<api>/estates/<estate-uuid>/assets/<asset-uuid>/inspections'
```

The 201 body has `outcome: "FAIL"` and `workOrder: null`. Saving this result
does not create a work order.
