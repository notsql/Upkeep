# Historical reading imports

Contract source: `packages/api/openapi.json`. Controllers and services are in
`com.proj.server.reading`; typed repositories use the Prisma-generated jOOQ
import tables. Migration: `20261106135312_historical_reading_imports`.

All paths below require a signed-in, current estate Owner or Manager under
`EstatePermissions.Authority.manager()`. Crew manual-entry permission, custom
estate grants and provider admin claims do not grant import/report access.
Import and revert require an active estate, including retries. Reports and
history remain readable after deactivation. Foreign/missing estates or batches
return 404; same-estate unauthorized roles return 403.

## Endpoints

Prefix: `/estates/{estateId}/readings/imports`; path IDs are UUIDs.

| Method/path | Request | Success |
| --- | --- | --- |
| POST prefix | Multipart `file` (UTF-8 CSV) and `options` (`application/json`, ReadingImportOptions) | 201 ReadingImportBatchResponse; 200 identical submission retry |
| GET prefix | `page: int32=0`, `size: int32=50` | 200 ReadingImportBatchPage, newest first |
| GET `/{batchId}` | No body | 200 ReadingImportBatchResponse |
| GET `/{batchId}/rows` | `page: int32=0`, `size: int32=50`, optional `outcome: IMPORTED\|DUPLICATE\|INVALID` | 200 ReadingImportRowPage |
| GET `/{batchId}/report` | No body | 200 UTF-8 attachment CSV, `Cache-Control: private, no-store` |
| POST `/{batchId}/revert` | RevertReadingImportRequest | 200 ReadingImportBatchResponse, including repeated rollback |

Pages are zero-based; size is 1–200. Lists contain `items: DTO[]`, `page: int32`,
`size: int32`, `totalItems: int64`. GET `/access/context` additionally projects
`canImportReadings: boolean` and `canRevertReadingImports: boolean` (optional
additions in OpenAPI for existing clients). Both are true only for active-estate
Owners/Managers. Inactive Managers retain read access to batches.

Errors use `EstateError { message: string }`: 400 invalid file/options/required
parts/pagination, 401 signed out, 403 insufficient role, 404 missing/foreign estate
or batch, 409 inactive estate or conflicting submission, 413 byte/record/field
limits, 415 unsupported upload/encoding, 503 capacity busy or database failure.
A well-formed all-invalid file returns a completed 201 batch and its full report.
CSV structure/limit failures insert nothing; ordinary row failures allow partial
acceptance. Storage failures roll back both measurements and batch/report writes.

## DTOs

ReadingImportOptions:

| Field | Type |
| --- | --- |
| submissionId | required UUID; reuse after an uncertain response |
| sourceLabel | required nonblank string, maximum 200 characters |
| preset | required `VENDOR` or `EXPORT` |
| assetLookupMode | required `asset_id` or `asset_reference` |
| mapping | required object mapping canonical field names to CSV header strings |

Map the selected asset field plus `metric`, `measured_at`, `value`; `unit` is
optional. A column supplies one field. EXPORT fills mappings from canonical
export headers and reverses spreadsheet escaping only in the export's escaped
text fields. Extra export provenance is context, never mutation authority.

ReadingImportBatchResponse:

- `id`, `estateId`, `submissionId`: UUID.
- `sourceLabel`, `originalFilename`, `fileHash` (SHA-256), `parserVersion`,
  `uploaderUserId`: string; `sizeBytes`: int32.
- `mapping`: object of string values; `preset`: VENDOR/EXPORT;
  `assetLookupMode`: string.
- `uploaderName`: optional nullable string, server-resolved snapshot.
- `createdAt`: UTC date-time; `status`: COMPLETED/REVERTED.
- `totalRows`, `importedRows`, `duplicateRows`, `invalidRows`, `warningRows`:
  int32. Imported + duplicate + invalid equals total; warnings are additional.
- `rollbackUserId`, `rollbackReason`: optional nullable string;
  `rollbackAt`: optional nullable UTC date-time; `removedCount`: optional nullable int32.

ReadingImportRowResponse:

- `recordNumber`, `startingLineNumber`: int32, required. Header is record 1;
  entirely blank records do not increment record numbering. Multiline quoted
  records have one record number and the starting physical line.
- `outcome`: required IMPORTED/DUPLICATE/INVALID.
- `readingId`, `assetId`: optional nullable UUID; `source`: optional nullable
  SENSOR/MANUAL/IMPORT; `metric`: optional nullable string.
- `measuredAt`: optional nullable UTC date-time; `valueText`: optional nullable
  exact decimal string.
- `origin`: required object of untrusted export context strings.
- `issues`: required ReadingImportIssue[], each with required `field`, `code`,
  `reason` strings. Stable codes include ASSET_NOT_FOUND, ASSET_RETIRED,
  INVALID_METRIC, INVALID_TIMESTAMP, INVALID_VALUE, INVALID_UNIT,
  OUT_OF_RANGE and READING_CONFLICT.

RevertReadingImportRequest: `{ reason: string }`, nonblank, at most 2,000
characters. The report CSV header is
`recordNumber,startingLineNumber,outcome,field,code,reason`. Each issue has its
own line; an outcome without issues has one line with empty issue fields.
Text is spreadsheet-safe, and a report includes every row across all pages.

## Validation, identity and lifecycle

Files are comma-delimited UTF-8, optionally BOM-prefixed, with quoted commas,
escaped quotes, multiline fields and LF/CRLF endings. Limits: 25 MiB, 100,000
nonblank records, 128 columns, and 4,096 characters per header/data field.
Structural field/column limits also apply to records that would otherwise be
ignored as blank.
Two processing slots bound concurrent imports. Other multipart endpoints retain
their former 5 MiB file/17 MiB request ceiling; document validation still limits
a document to 5,000,000 bytes.

Assets resolve only within the selected estate and must currently be active;
no device is required. Metrics and optional units match the fixed catalogue.
Times require an ISO-8601 offset, normalize to UTC microseconds, accept old and
out-of-order readings, and reject times over five minutes in the future.
Values are parsed directly as decimals, bounded by numeric(18,6), including
trailing-zero equivalents. Out-of-range values import with OUT_OF_RANGE warnings.

Imported identity is estate/asset/metric/measurement instant. Equal exact values
are duplicates; different values conflict without overwriting. Within-file rows
are processed in record order. Export source/reading IDs recognize an existing
same-estate measurement only after comparing its full normalized contents.
Unknown exported IDs are hints and never become new reading IDs.

Submission identity is estate/uploader/submission UUID plus identical bytes,
source and normalized options. An identical retry returns the original batch,
even after rollback; a deliberate new UUID can import reverted measurements.
Estate write locks serialize lifecycle changes, imports and rollback. Rollback
removes only the batch's own inserts. Duplicates, other batches and sensor/manual
measurements survive. Batch metadata and normalized row reports remain
indefinitely; original uploaded files are not permanently retained.

## Reading consumers

Estate and legacy asset lists union imports before flags, filters and paging.
Legacy asset history retains Owner-only authorization. Reading DTOs add optional
nullable `importBatchId: UUID`, `sourceLabel: string`, plus source IMPORT. Exact
`valueText` remains available. CSV v1's 15-column header is unchanged: imported
rows have their own reading ID, import time in recorded_at, and empty device and
manual-recorder columns. Batch provenance is available through the reading DTO
and these restricted batch endpoints.

Duplicate-timestamp flags span all three sources. Imports do not fill sensor
GAPs, change last-seen/flatline evidence, run anomaly checks, create assessments,
or update failure-risk inputs. Rollback removes the rows from subsequent lists
and exports without requiring model-result cleanup.

Example options part for a vendor file:

```json
{
  "submissionId": "9edfdd92-57cc-48aa-bf4a-f33f0e74f964",
  "sourceLabel": "Vendor A — October 2026 extract",
  "preset": "VENDOR",
  "assetLookupMode": "asset_reference",
  "mapping": {
    "asset_reference": "Equipment",
    "metric": "Signal",
    "measured_at": "Observed",
    "value": "Measurement"
  }
}
```

A four-record batch with one accepted row, one duplicate and two invalid rows
reports `totalRows=4`, `importedRows=1`, `duplicateRows=1`, `invalidRows=2`, and
commits the accepted row. Inspect `/{batchId}/rows` or download its report before
correcting/re-uploading rejected vendor records.
