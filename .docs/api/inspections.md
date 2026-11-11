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
| POST | `/assets/{assetId}/inspections/photo-slots` | JSON `InspectionPhotoSlotRequest` | 201 `UploadSlotResponse` (ten-minute upload link for one photo) |
| POST | `/assets/{assetId}/inspections` | JSON `CreateInspectionRequest` | 201 `InspectionResultResponse`; `Location` is its nested detail path |
| GET | `/assets/{assetId}/inspections` | Optional `cursor: string`, `limit: integer` (default 20, 1–50) | 200 `InspectionResultPageResponse` |
| GET | `/assets/{assetId}/inspections/{inspectionId}` | Path IDs; validates the complete estate/asset/result relationship | 200 `InspectionResultResponse` |
| GET | `/inspection-results/{inspectionId}` | Estate and result IDs | 200 `InspectionResultResponse`; authorised source lookup for the work-order conversion URL |
| GET | `/assets/{assetId}/inspections/{inspectionId}/photos/{photoId}` | Full relationship checked before a link is signed | 200 `SignedDownloadResponse { url, expiresAt }`, a five-minute link to the private photo |

No result/photo update or deletion endpoint exists. Unsupported methods and
nested actions are denied by the configured JWT security chain.

## DTOs

`InspectionPhotoSlotRequest` (POST `/assets/{assetId}/inspections/photo-slots`,
201 `UploadSlotResponse`, see [documents.md](documents.md)):

- `contentType: string`, required; JPEG or PNG, else 415.
- `size: int64`, required; 1 byte to 5 MiB, else 400/413.
- `inspectionId?: UUID`; omit for the first photo. The response's
  `inspectionId` names the inspection; pass it to later slots and to the create
  call so every key sits under `inspections/{inspectionId}/`.

Slots need the same authority as recording (403/404 otherwise, 409 when the
estate, asset or location is inactive) and storage (503). The browser PUTs each
photo to `uploadUrl` within ten minutes.

`CreateInspectionRequest`, JSON:

- `inspectionId?: UUID`, required when `photoKeys` is not empty; the id from the
  slots becomes the result's id.

- `outcome: "PASS" | "FAIL"`, required; no inferred/default outcome.
- `inspectedOn: string` (ISO date), required; no later than Singapore today or
  earlier than the asset's known installation date.
- `expectedLocationId: UUID`, required; location observed when the form opened.
  A moved asset returns 409 and requires review.
- `notes?: string`; trimmed, maximum 2,000 characters after trimming; blank is
  stored as null.
- `photoKeys?: string[]`; object keys from the slots, at most three, already
  uploaded. A key with nothing behind it, outside this inspection's prefix, or
  already saved is 400 (a foreign key's object is left alone). Each stored photo
  must be JPEG/PNG, at most 5 MiB, maximum 4,032 by 3,024 pixels; the server
  checks its real size, type, content and dimensions, re-encodes it and replaces
  the upload with the clean copy. A photo that fails is deleted (413/415/400).

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

Authority, input and key checks happen before storage is touched. Optional
inspector-name lookup and the photo checks run outside the write transaction. The transaction locks
the estate first, rechecks current membership/activity/location, and writes
one result and its evidence metadata together. A failed commit deletes the
uploaded photos. An hourly sweep deletes objects under the private
`inspections/` prefix that are older than 24 hours and saved with no result,
which also covers uploads that were never confirmed. Photo-free
submissions work without configured storage. Resident-report APIs cannot read
inspection evidence; no keys or public bucket URLs appear in DTOs.

In the same write transaction, saving a result completes the asset's open monthly check, if it
has one ([inspection-list.md](inspection-list.md)). The request and response are unchanged.

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

## A Fail needs a note (equipment dispatch)

`outcome` `FAIL` with blank or whitespace-only `notes` returns 400 "Say what's
wrong so the manager knows what to fix." A saved Fail raises a `CHECK_FAILED`
notification for the estate's managers, and any saved result resolves the
asset's open `CHECK_REQUESTED`/`CHECK_FAILED` notifications. See
[equipment-dispatch.md](equipment-dispatch.md).
