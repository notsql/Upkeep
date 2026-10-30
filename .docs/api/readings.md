# Readings API

## Estate browser (ID-60 / ID-63 / ID-64)

The following endpoints are read-only. Current estate Owners, Managers and Crew
may read, including retired assets and inactive-estate history. Resident,
Member, Council and custom-role memberships alone do not grant access. Current
membership is checked on each request. `canViewReadings: boolean` is a required
`EstateAccessResponse` field under the same policy. Minimal asset labels do not
grant asset-register, cost, editing or credential access. ID-63 adds the
`ManualReading` table through Prisma migration `20261027190834_manual_readings`.

The reading GET paths and manual POST are explicit SecurityConfig entries. Missing authentication is
401; a same-estate unauthorized role is 403; a missing/foreign estate or selected
asset is 404; invalid filters/pagination are 400. All errors use
`EstateError { message: string }`. Valid lists, including empty lists, return 200.
Manual writes use the separate authenticated endpoint documented below.

### GET `/estates/{estateId}/readings`

Operation `listEstateReadings`. Required path `estateId: UUID`; query:

| Field | Type / default | Meaning |
| --- | --- | --- |
| assetId | UUID, optional | One asset, otherwise all assets in this estate |
| metric | DeviceMetric, optional | Catalogue metric |
| from | date-time, optional | Inclusive measured time |
| to | date-time, optional | Exclusive measured time; after `from` if both are supplied |
| flag | ReadingFlagType[], optional, repeated | Match any selected GAP / DUPLICATE_TIMESTAMP / OUT_OF_RANGE flag |
| page | int32, default 0 | Non-negative offset page |
| size | int32, default 50 | 1–200 |

Filters combine before counting/pagination. Order: `measuredAt DESC, id DESC`.
`EstateReadingPage { items: EstateReadingResponse[], page: int32, size: int32,
totalItems: int64 }`. Each `EstateReadingResponse` contains all the existing
`AssetReadingResponse` fields below plus required `assetId: UUID`,
`assetReference: string`, `assetName: string`.

Reading ownership follows its recorded asset, including after device movement.
Flags are calculated per asset/metric; different assets cannot create duplicate
or gap flags together. A time filter never hides the earlier timestamp needed
for a gap. The predecessor query uses an indexed strictly-earlier lookup instead
of an unbounded EXCLUDE GROUP window. This optimization also serves the legacy
endpoint. ID-63/64 extend row DTOs with provenance and mixed-source duplicate
flags while preserving legacy ownership checks and sensor-only gap cadence.

Example: `GET /estates/{estateId}/readings?assetId={assetId}&metric=PRESSURE&from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z&size=50`.
An excessive page returns empty items with the matching total; offset paging is
live, without a snapshot guarantee across concurrent submissions.

### GET `/estates/{estateId}/readings/assets`

Operation `listReadingAssets`; same role policy. Required path `estateId: UUID`.
Query: `search?: string` (trimmed, literal case-insensitive name/reference
substring), `page?: int32 = 0`, `size?: int32 = 50` (1–200).

`ReadingAssetOptionPage { items: ReadingAssetOption[], page: int32, size: int32,
totalItems: int64 }`. Each option has required `id: UUID`, `reference: string`,
`name: string`, `retired: boolean`. Includes retired assets and those without
readings. Results order by name, reference and ID ascending; search/count remain
estate-scoped. No financial or credential fields are returned.

## Manual entry (ID-63 / ID-64)

### GET `/estates/{estateId}/readings/metrics`

Operation `listReadingMetrics`. Path `estateId: UUID`; no query/body. The same
read policy applies, including inactive-estate history. Returns 200
`ReadingMetricOption[]`, each with required `metric: DeviceMetric`, `unit: string`,
`validMin: double`, `validMax: double`. Exactly the existing eight catalogue
metrics and units/ranges are returned (table below). No custom metric creation.
Errors: 401 unauthenticated; 403 unsupported membership; 404 missing/foreign estate.

### POST `/estates/{estateId}/readings/manual`

Operation `createManualReading`. Owners, Managers and Crew may create against an
active estate and active same-estate asset, including an asset with no device.
An inactive location alone does not retire an asset. `canRecordReadings` is true
only for those roles in an active estate; the server checks authority again.

`CreateManualReadingRequest` has exactly six required fields; unknown fields,
duplicate keys, trailing JSON and unsupported value types are rejected:

| Field | Type | Meaning |
| --- | --- | --- |
| assetId | UUID | Same-estate asset |
| metric | DeviceMetric | Existing catalogue metric |
| value | number or string | Prefer exact decimal text, at most 12 integer / 6 meaningful fractional digits; legacy numbers retain half-up rounding to 6 places |
| unit | string | Exactly the catalogue unit, including case/Unicode |
| measuredAt | date-time | UTC offset required; backdating allowed; at most 5 minutes ahead |
| submissionId | UUID | Stable for identical/uncertain retries; new for a changed payload |

Out-of-range values are saved, then flagged by read APIs. The server derives
recorder subject from the JWT and snapshots the display name via the existing
WorkOS lookup. Name lookup failure is allowed; subject remains available.

201 creates one row; 200 returns the original for a numerically/timestamp-equivalent
retry. The `(estateId, recordedByUserId, submissionId)` key scopes retry identity.
The estate row lock serializes manual submissions with lifecycle changes and
concurrent retries. An existing identical retry remains readable after retirement
or estate deactivation, but revoked recording roles cannot use the endpoint.
A changed asset/metric/value/time under the same key returns 409.

Decimal strings are parsed directly to BigDecimal and never through double.
At most 64 characters are accepted; decimal/exponent notation is supported.
Redundant trailing fractional zeroes do not count as excess precision. Text with
more than six meaningful fractional places gets 400 (`Value can have at most six
decimal places.`). Invalid text, excessive integer digits and out-of-storage-range
values also get 400. Numeric clients keep their documented rounding behaviour;
booleans/null/objects and spoofed recorder metadata remain rejected. Outside-
expected-range measurements remain saveable and flagged.

Both success responses use `ManualReadingResponse` with required fields:
`id: UUID`, `assetId: UUID`, `metric: DeviceMetric`, `value: number`, `unit: string`,
`measuredAt: date-time (UTC)`, `recordedAt: date-time (UTC)`, `source: MANUAL`,
`recordedByUserId: string`, `recordedByName: string | null`.
An optional `valueText: string` is also emitted: the exact stored decimal in
plain notation, without unnecessary trailing zeroes. New clients use it for
lossless display; the existing numeric value remains compatible. The same field
is emitted by estate and legacy asset reading responses for both sources.
`Cache-Control: private, no-store`. The device-ingestion contract is unchanged.

Errors use `EstateError`: 400 invalid payload/unit/value/time/UUID, 401 signed out,
403 unsupported role, 404 missing/foreign estate or asset, 409 inactive estate,
retired asset or conflicting submission. No edit/delete endpoint is provided.

Example body (use real UUIDs):

```json
{"assetId":"c4d20000-0000-4000-8000-000000000001","metric":"TEMPERATURE","value":"151","unit":"°C","measuredAt":"2026-10-01T16:00:00+08:00","submissionId":"a1b20000-0000-4000-8000-000000000001"}
```

ID-61 now exports source and recorder metadata through the endpoint below,
completing ID-64's CSV provenance criterion.

## Legacy owner-only per-asset browser (ID-67)

Contract: `packages/api/openapi.json` (operationId `listAssetReadings`). Read-only:
lists the union of `ManualReading` and ID-43's `DeviceReading` table (see
[device-readings.md](device-readings.md)) for one asset, with the suspect-data
flags computed on every request. Nothing is written; flags are never stored.
Spec: `.spec/features/suspect-readings.md`. Code: `com.proj.server.reading`
(`AssetReadingController`, `AssetReadingService`, `AssetReadingRepository`).

Requires bearer JWT and estate ownership. Missing authentication returns 401
(`Sign in to view readings.`); a foreign or missing estate returns 404
(`Estate not found.`), an asset not in the estate 404 (`Asset not found.`).
A deactivated (retired) asset's readings are still listed. Spring Security
explicitly allows this GET path. Query parameters are validated **before**
ownership, so a bad request gets 400 even on an estate the caller cannot see.
A same-estate RESIDENT membership returns 403 (`findOwned`'s resident check).

## GET `/estates/{estateId}/assets/{assetId}/readings`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- query `metric`: DeviceMetric (optional) - one metric only
- query `from`: date-time (optional) - inclusive, `measuredAt >= from`
- query `to`: date-time (optional) - exclusive, `measuredAt < to`
- query `flag`: array of GAP / DUPLICATE_TIMESTAMP / OUT_OF_RANGE (optional) - repeatable (`?flag=GAP&flag=OUT_OF_RANGE`); lists readings carrying **any** of them. Omitted: every reading, flagged or not
- query `page`: int32 (optional, default 0) - starts at 0
- query `size`: int32 (optional, default 50) - 1 to 200
- 400: Unknown metric or flag, a malformed time, from not before to, or page or size out of range - EstateError
- 401: Sign in required - EstateError
- 403: Resident membership does not grant management access - EstateError
- 404: Estate or asset not found - EstateError
- 200: One page of the asset's readings, newest first - AssetReadingPage

Filters combine (AND); `totalItems` counts only matching readings.

### 400 messages

| Cause | `message` |
| --- | --- |
| Unknown `metric` or `flag` (case-sensitive), malformed `from`/`to`, non-numeric `page`/`size` | `<param>: "<value>" is not a valid value.` |
| `page` < 0 | `page: must be 0 or more.` |
| `size` < 1 or > 200 | `size: must be between 1 and 200.` |
| `from` and `to` both given and `from` not before `to` | `from: must be before to.` |

Checked in that order (page, size, from/to), then estate, then asset.

### Ordering

`measuredAt` descending, then `id` descending, so pages never overlap.

## AssetReadingPage

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| items | AssetReadingResponse[] | yes |  |
| page | int32 | yes | Echoes the request |
| size | int32 | yes | Echoes the request |
| totalItems | int64 | yes | How many readings match the filters, across all pages |

## AssetReadingResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| measuredAt | date-time | yes | In UTC (`Z`) |
| metric | TEMPERATURE / HUMIDITY / PRESSURE / FLOW_RATE / VIBRATION / VIBRATION_ACCELERATION / POWER / ENERGY | yes |  |
| unit | string | yes | The metric's catalogue unit |
| value | number | yes | Compatibility numeric representation, rounded to 6 places in storage |
| valueText | string | no | Exact stored decimal in plain notation; prefer for display, numeric value is the older-server fallback |
| deviceId | uuid or null | yes | Device for SENSOR; null for MANUAL |
| deviceIdentifier | string or null | yes | Device identifier for SENSOR; null for MANUAL |
| flags | ReadingFlagResponse[] | yes | Empty when nothing is suspect; order GAP, DUPLICATE_TIMESTAMP, OUT_OF_RANGE |
| source | SENSOR / MANUAL | yes | Derived from the stored table, never client-assigned |
| recordedByUserId | string or null | yes | Authenticated recorder subject for MANUAL; null for SENSOR |
| recordedByName | string or null | yes | Recorder display-name snapshot; nullable when unavailable |
| recordedAt | date-time | yes | UTC time of manual recording or sensor receipt |

## ReadingFlagResponse

Fields not applicable to the type are omitted from the JSON (not `null`).

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| type | GAP / DUPLICATE_TIMESTAMP / OUT_OF_RANGE | yes |  |
| gapSeconds | int64 | no | GAP only: whole seconds since the previous reading of this metric on the asset |
| validMin | double | no | OUT_OF_RANGE only: the metric's inclusive minimum |
| validMax | double | no | OUT_OF_RANGE only: the metric's inclusive maximum |

## EstateError

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| message | string | yes |  |

## Flag rules

Flags are computed in one query over **every stored reading of the asset**
(narrowed only by `metric`, which never changes a flag). The time window, flag
filter and paging apply on top, so a page and `totalItems` always agree, a
window never hides a reading's predecessor, and duplicates on different pages
are all flagged.

- **OUT_OF_RANGE**: `value < validMin` or `value > validMax` for the reading's
  metric, compared as stored decimals (`numeric(18,6)`). Bounds are inclusive:
  `150.000000` °C is in range, `150.000001` is not. Ranges come from
  `DeviceMetric` (below).
- **DUPLICATE_TIMESTAMP**: at least one other reading shares the asset, metric
  and `measuredAt` at stored (microsecond) precision. Every such reading is
  flagged, equal values or not. One device cannot store two readings of a metric
  at one instant (unique index, decision 0028); duplicates may be across
  devices, manual entries or sources. Identical submission retries add no row.
- **GAP**: applies only to SENSOR rows. The previous sensor reading is the latest one for the same asset and metric
  with a **strictly earlier** `measuredAt`, from any device. Flagged when the
  difference is more than **1.5 ×** the `reportingIntervalSeconds` of the
  reading's own device (the device's current interval). Exactly 1.5 × is not
  flagged. The earliest stored reading has no predecessor and is never flagged.
  `gapSeconds` is the difference rounded down to whole seconds. Readings sharing
  an instant never precede each other, so duplicates ending a gap all carry it.
  A late sensor reading stored inside a gap clears the flag on the next request.
  Manual entries do not fill sensor gaps and never receive GAP themselves.

## Valid ranges

| Metric | Unit | Min | Max |
| --- | --- | --- | --- |
| TEMPERATURE | °C | -40 | 150 |
| HUMIDITY | % | 0 | 100 |
| PRESSURE | bar | 0 | 25 |
| FLOW_RATE | L/min | 0 | 10000 |
| VIBRATION | mm/s | 0 | 100 |
| VIBRATION_ACCELERATION | g | 0 | 16 |
| POWER | kW | 0 | 1000 |
| ENERGY | kWh | 0 | 10000000 |

## Storage

Reads `DeviceReading` joined to `Device` (for `identifier` and
`reportingIntervalSeconds`) and `ManualReading` as a SQL union before duplicate
calculation, filtering, counting and pagination. Both tables have an
`(assetId, metric, measuredAt)` index. Manual entries preserve recorder identity
and do not affect device last-seen, flatline or inference paths.
A reading keeps the `assetId` it arrived with, so it stays on the old asset
after its device moves.

## Example

```http
GET /estates/7a1c.../assets/c4d2.../readings?metric=TEMPERATURE&from=2026-10-17T00:00:00Z&flag=GAP&flag=OUT_OF_RANGE&size=2
Authorization: Bearer <jwt>
```

200:

```json
{"items":[{"id":"9d3e...","measuredAt":"2026-10-17T12:00:00Z","metric":"TEMPERATURE","unit":"°C","value":151.000000,"deviceId":"2b1e...","deviceIdentifier":"pump-1-temp","source":"SENSOR","recordedByUserId":null,"recordedByName":null,"recordedAt":"2026-10-17T12:00:01Z","flags":[{"type":"GAP","gapSeconds":5400},{"type":"OUT_OF_RANGE","validMin":-40.0,"validMax":150.0}]}],"page":0,"size":2,"totalItems":1}
```


## Filtered CSV export (ID-61 / ID-64)

### GET `/estates/{estateId}/readings/export`

Operation `exportEstateReadings`. Current Owners, Managers and Crew may export,
including inactive-estate and retired-asset history. Identity and estate/asset
scope are checked before response creation and again on the streaming worker.
Resident, Council, Member and custom roles alone do not grant this capability.

Path `estateId: UUID`. Optional query fields: `assetId: UUID`, `metric:
DeviceMetric`, `from: date-time` (inclusive), `to: date-time` (exclusive), and
repeated `flag: ReadingFlagType`. These have exactly the list endpoint's filter
semantics. Page/size are not export parameters and do not limit matching rows.
Order is measuredAt DESC / id DESC. Flags retain full required history before
time/flag filtering. Sensor/manual rows share one query snapshot; concurrent new
measurements need not appear in an already-open export.

200 has binary `text/csv; charset=utf-8` content and these headers:

- `Content-Disposition: attachment; filename="readings-v1-<estate UUID>-<UTC uuuuMMddTHHmmssZ>.csv"`.
- `X-Export-Row-Count: <integer>` is the complete number of data records from the
  same query snapshot, excluding the header. Both download headers are exposed
  through CORS. Clients must validate complete transfer/record count.
- `Cache-Control: private, no-store`.

An empty result is a header-only CSV with count 0. Errors before output use JSON
`EstateError { message: string }`: 400 invalid metric/flag/UUID/time/range, 401
signed out, 403 unsupported membership, 404 missing/foreign estate or selected
asset, 503 export capacity busy. Busy message: Reading exports are busy. Please
retry shortly. An interrupted stream is not a complete CSV, even if headers had
already been sent; do not append/interpret an error as a valid measurement.

### CSV schema v1

UTF-8 with one leading BOM (EF BB BF) for Excel encoding detection;
comma-separated; CRLF record endings. After the BOM, the first record is the
fixed unquoted header below. Data fields are double-quoted, and double quotes in
fields are doubled. Embedded commas/newlines and Unicode remain valid CSV.

| Column, in order | Meaning and format |
| --- | --- |
| reading_id | Measurement UUID; combine with source for identity |
| measured_at | UTC `uuuu-MM-ddTHH:mm:ss.SSSSSSZ`, exactly six fractional digits |
| asset_id | Recorded asset UUID |
| asset_reference | Current asset reference, text escaping below |
| asset_name | Current asset name, text escaping below |
| metric | Stable DeviceMetric enum code |
| value | Decimal with exactly six fractional digits; no grouping or exponent |
| unit | Catalogue unit, e.g. °C / bar / kWh |
| source | SENSOR or MANUAL |
| device_id | Sensor device UUID, empty for manual |
| device_identifier | Sensor device identifier, empty for manual |
| recorded_by_user_id | Stored authenticated manual recorder subject, empty for sensor |
| recorded_by_name | Stored manual display-name snapshot, empty when unavailable or sensor |
| recorded_at | Sensor receipt/manual recording instant, same UTC format |
| flags | Semicolon-separated GAP;DUPLICATE_TIMESTAMP;OUT_OF_RANGE in that order, empty if none |

For values beyond 15 significant digits, Excel imports must treat value as Text
to preserve all digits; decimal-aware pipeline readers should use Decimal as in
the example below. See [Microsoft guidance](https://support.microsoft.com/en-us/excel/keeping-leading-zeros-and-large-numbers).

A missing name stays empty while its stable recorder ID remains available.
Manual rows never gain a fake device. Empty metadata and numeric `0.000000` are
distinct. This export performs no interpolation, aggregation, rounding beyond
stored six-decimal precision, anonymization or model-specific transformation.

Spreadsheet-safe text columns are asset_reference, asset_name,
device_identifier, recorded_by_user_id and recorded_by_name. A leading apostrophe
is added if the original starts with an apostrophe or ASCII control character,
or its first non-whitespace character is `=`, `+`, `-` or `@`. Leading whitespace
means Java whitespace characters or codepoints <= U+0020. Original leading
apostrophes are also doubled, so decoding is reversible: remove exactly one
leading apostrophe in these text columns. Other characters, numeric values and
units are unchanged. Example: original `=Pump` exports as `'=Pump`; original
`'Pump` exports as `''Pump`. Standard CSV quote escaping applies afterward.

The BOM identifies UTF-8 when opening directly in Excel, so `°C` displays
correctly. BOM-aware readers remove the marker before interpreting the first
column name; it is not a data cell or an extra record. A minimal Python consumer
(no additional packages):

```python
import csv
from decimal import Decimal

text_columns = {
    "asset_reference", "asset_name", "device_identifier",
    "recorded_by_user_id", "recorded_by_name",
}
with open("readings.csv", encoding="utf-8-sig", newline="") as source:
    for row in csv.DictReader(source):
        for column in text_columns:
            if row[column].startswith("'"):
                row[column] = row[column][1:]
        measurement = Decimal(row["value"])
        flags = row["flags"].split(";") if row["flags"] else []
        # source identifies SENSOR/MANUAL; empty metadata is not a fabricated name.
```

### Streaming and limits

`ReadingExportController`, `ReadingExportAdmission`, `ReadingExportService` and
`ReadingCsvWriter` own the export. Admission reserves capacity before response
creation, with at most two active transfers per instance. MVC's executor has two
workers and no waiting queue. A read-only transaction starts on the actual worker;
jOOQ fetches 512 rows per batch and output flushes every 128 records. Its query
shares the browser projection, adds a window count and has no pagination or
whole-result Java list. Cursor and connection close on output failure.

Timeouts: transaction 230s, MVC 240s, Cloud Run deployment 300s. No persisted file,
background job, migration, storage dependency or export history is created.
Request cancellation frees the cursor/worker; the frontend verifies completion
before saving its Blob. Large-file evidence and opt-in benchmark commands are in
the frontend document and ID-61 spec. The benchmark is local real HTTP, not a
claim that a manual production Cloud Run deployment was performed.
