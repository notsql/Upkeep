# Asset readings API

Contract: `packages/api/openapi.json` (operationId `listAssetReadings`). Read-only:
lists the readings stored in ID-43's `DeviceReading` table (see
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
| value | number | yes | As stored: rounded to 6 decimal places |
| deviceId | uuid | yes | The device that sent it |
| deviceIdentifier | string | yes | That device's `identifier` |
| flags | ReadingFlagResponse[] | yes | Empty when nothing is suspect; order GAP, DUPLICATE_TIMESTAMP, OUT_OF_RANGE |

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
  at one instant (unique index, decision 0028), so this only arises across
  devices.
- **GAP**: the previous reading is the latest one for the same asset and metric
  with a **strictly earlier** `measuredAt`, from any device. Flagged when the
  difference is more than **1.5 ×** the `reportingIntervalSeconds` of the
  reading's own device (the device's current interval). Exactly 1.5 × is not
  flagged. The earliest stored reading has no predecessor and is never flagged.
  `gapSeconds` is the difference rounded down to whole seconds. Readings sharing
  an instant never precede each other, so duplicates ending a gap all carry it.
  A late reading stored inside a gap clears the flag on the next request.

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
`reportingIntervalSeconds`), using the `(assetId, metric, measuredAt)` index.
A reading keeps the `assetId` it arrived with, so it stays on the old asset
after its device moves.

## Example

```http
GET /estates/7a1c.../assets/c4d2.../readings?metric=TEMPERATURE&from=2026-10-17T00:00:00Z&flag=GAP&flag=OUT_OF_RANGE&size=2
Authorization: Bearer <jwt>
```

200:

```json
{"items":[{"id":"9d3e...","measuredAt":"2026-10-17T12:00:00Z","metric":"TEMPERATURE","unit":"°C","value":151.000000,"deviceId":"2b1e...","deviceIdentifier":"pump-1-temp","flags":[{"type":"GAP","gapSeconds":5400},{"type":"OUT_OF_RANGE","validMin":-40.0,"validMax":150.0}]}],"page":0,"size":2,"totalItems":1}
```
