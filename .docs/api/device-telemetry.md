# Device telemetry API

Contract: `packages/api/openapi.json`. Called by devices (and the device
simulator), never by the web app. Auth is the device's API key
(`Authorization: Bearer upk_...`), exactly as `/device-api/readings`
(`device-readings.md`). The device, asset and estate come only from the key.
Spec: `.spec/features/streaming-anomaly-detection.md` ("Batch telemetry endpoint").
Code: `com.proj.server.reading.DeviceTelemetryController`, `ReadingService.submitBatch`.

## POST `/device-api/telemetry` (operation `submitTelemetry`)

- Body: TelemetryBatchRequest (`application/json`)
- 200: Each item decided on its own - TelemetryBatchResponse
- 400: Body is not a JSON object with only `readings`, an array of 1 to 500 items; nothing stored - EstateError
- 401: Missing, malformed, unknown or replaced device key; nothing stored - EstateError
- 409: The estate is inactive; nothing stored - EstateError (`This estate is inactive. Readings are not accepted.`)

Checks run in this order: key (401), batch shape (400), estate (409), then
each item in request order.

400 messages:

| Problem | message |
| --- | --- |
| Not JSON, not an object, trailing content, or a field given twice (anywhere in the body) | `The request body must be a JSON object, with each field given once.` |
| `readings` missing or null | `readings is required.` |
| Any other top-level field | `<field> is not accepted. A batch has only readings.` |
| `readings` not an array | `readings must be an array.` |
| 0 or more than 500 items | `readings must have 1 to 500 items; got <n>.` |

## TelemetryBatchRequest

No other fields are accepted.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| readings | CreateReadingRequest[] | yes | 1 to 500 items; each item has the shape and rules of a `/device-api/readings` body (see `device-readings.md`) |

## TelemetryBatchResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| results | TelemetryItemResult[] | yes | One per item, in request order |

## TelemetryItemResult

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| index | int32 | yes | The item's position in `readings`, from 0 |
| status | TelemetryItemStatus | yes | `CREATED`, `ALREADY_STORED`, `INVALID`, `CONFLICT` |
| reading | ReadingResponse | no | Present only for `CREATED` and `ALREADY_STORED` (the stored reading, with its original `receivedAt`) |
| message | string | no | Present only for `INVALID` and `CONFLICT` |

- `CREATED`: stored now.
- `ALREADY_STORED`: an identical reading (device, metric, `measuredAt`, value after rounding) was already stored, possibly by an earlier item in the same batch.
- `INVALID`: the item failed one of single-reading rules 2-10 (`device-readings.md`), with that rule's message. An item that is not a JSON object gives `A reading must be a JSON object.`
- `CONFLICT`: a different value is already stored for this metric and `measuredAt` (possibly by an earlier item in the batch): `A different value is already stored for <METRIC> at <measuredAt>. A correction needs a new measuredAt.`

An `INVALID` or `CONFLICT` item never stops other items being stored. If at
least one item is `CREATED` or `ALREADY_STORED`, the device's `lastSeenAt` is
set once to the receipt time (never moving backwards); otherwise it is
unchanged. Stored rows are ordinary `DeviceReading` rows.

## Anomaly scoring (decision 0044)

If a request stores at least one new reading, the asset is scored after the
transaction commits, on a background executor. The response never waits for
scoring and is never changed by its failure. A request that stores nothing
(every item `ALREADY_STORED`, `INVALID` or `CONFLICT`) starts no pass.
`/device-api/readings` triggers scoring the same way.

Code: `com.proj.server.anomaly.AnomalyScoringScheduler`, `AnomalyScoringService`,
`AnomalyScoringRepository`, `AbnormalRuns`.

- Only an active `PUMP` (not retired) in an active estate is scored.
- A **sample** is a `measuredAt` with exactly one `DeviceReading` for each of
  `VIBRATION_ACCELERATION`, `PRESSURE`, `TEMPERATURE`, `FLOW_RATE` and `POWER`.
  Manual readings are never used.
- Samples more than 2 s (`MAX_GAP`) apart start a new segment; the 10-row
  rolling window restarts at each segment, as in `AnomalyFeatureBuilder`.
- Each sample is scored once into `AnomalyScore` (`assetId`, `measuredAt`
  unique). A late sample is scored with the window as it stands; scored
  neighbours are not rescored.
- A pass scores at most 3,600 (`MAX_READINGS`) of the oldest unscored samples;
  further passes follow until a pass scores fewer.
- Passes for one asset are serialised by a Postgres advisory transaction lock
  on the asset ID. `MlUnavailableException` rolls the pass back; its samples
  are picked up by the next pass.
- After storing scores, the pass takes the longest abnormal run (scores
  >= 0.51, consecutive within a segment) that contains a sample it scored,
  the latest on a tie. Only samples measured after the `createdAt` of the
  asset's latest assessment by a person (a `recordedByUserId` without the
  `system:` prefix) count.
- A run of at least 10 samples is `FAULTY` if its median is >= 0.98, else
  `NEEDS_ATTENTION`. It is recorded as an `AssetAssessment` by
  `system:anomaly-model` / "Anomaly detection", `assessedOn` the run's last
  sample (UTC date), only if the asset's current condition differs. Notes:
  `<n> consecutive abnormal samples in device readings from <first> to <last>. Median score <m>, maximum <x>.`
  `GOOD` is never recorded, and a pass records at most one assessment.

## Example

```http
POST /device-api/telemetry
Authorization: Bearer upk_...
Content-Type: application/json

{"readings":[
  {"metric":"TEMPERATURE","value":21.5,"unit":"°C","measuredAt":"2026-11-07T10:00:00Z"},
  {"metric":"TEMPERATURE","value":21.6,"unit":"C","measuredAt":"2026-11-07T10:00:01Z"}
]}
```

```json
{"results":[
  {"index":0,"status":"CREATED","reading":{"id":"...","deviceId":"...","assetId":"...","metric":"TEMPERATURE","value":21.500000,"unit":"°C","measuredAt":"2026-11-07T10:00:00Z","receivedAt":"2026-11-07T10:00:02.123456Z"}},
  {"index":1,"status":"INVALID","message":"unit for TEMPERATURE must be °C; got C."}
]}
```
