# Device readings API

Contract: `packages/api/openapi.json`. Called by devices, never by the web app.
Auth is the device's API key (`Authorization: Bearer upk_...`, see the device
credentials section of `assets.md`). The device, its asset and its estate come
only from the key; the request carries no IDs. Spec: `.spec/features/device-readings.md`.
Decisions: 0016 (metric catalogue), 0025 (device keys), 0028 (duplicates and rounding).

## POST `/device-api/readings`

- Body: CreateReadingRequest (`application/json`), one reading per request
- 201: Reading stored - ReadingResponse
- 200: An identical reading was already stored; nothing changed, and the stored reading is returned - ReadingResponse
- 400: Malformed reading; `message` names the field and the problem - EstateError
- 401: Missing, malformed, unknown or replaced device key - EstateError (`A valid device key is required.`)
- 409: A different value is already stored for this metric and time, or the estate is inactive - EstateError

## CreateReadingRequest

No other fields are accepted.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| metric | TEMPERATURE / HUMIDITY / PRESSURE / FLOW_RATE / VIBRATION / VIBRATION_ACCELERATION / POWER / ENERGY | yes | Must be registered for this device |
| value | number | yes | A JSON number, never a string; at most 12 digits before the decimal point; rounded half-up to 6 places |
| unit | string | yes | Exactly the metric's catalogue unit (`°C`, `%`, `bar`, `L/min`, `mm/s`, `g`, `kW`, `kWh`) |
| measuredAt | date-time | yes | ISO-8601 with a UTC offset; at most 5 minutes after the server's time |

## ReadingResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| deviceId | uuid | yes |  |
| assetId | uuid | yes | The device's asset when the reading arrived |
| metric | DeviceMetric | yes |  |
| value | number | yes | As stored, with 6 decimal places |
| unit | string | yes | Derived from the metric |
| measuredAt | date-time | yes | UTC |
| receivedAt | date-time | yes | UTC; on a 200, the original receipt time |

## EstateError

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| message | string | yes |  |

## Validation order (first failure wins)

1. Body is not a JSON object, has trailing content, or repeats a field - 400 `The request body must be a JSON object, with each field given once.`
2. A field is missing or null, checked in the order metric, value, unit, measuredAt - 400 `metric is required.`
3. An undefined field - 400 `deviceId is not accepted. A reading has only metric, value, unit and measuredAt.`
4. Wrong JSON type - 400 `metric must be a string.`, `value must be a JSON number, such as 21.5. Strings and booleans are not converted.`, `unit must be a string.`, `measuredAt must be a string.`
5. More than 12 digits before the decimal point, before or after rounding - 400 `value must have at most 12 digits before the decimal point.`
6. Metric outside the catalogue (case-sensitive) - 400 `metric FOO is not supported. Supported metrics: TEMPERATURE, HUMIDITY, ...`
7. Metric not registered for the device - 400 `metric PRESSURE is not registered for this device. Registered metrics: TEMPERATURE.`
8. Unit mismatch, compared exactly - 400 `unit for TEMPERATURE must be °C; got C.`
9. Unparseable timestamp or no offset - 400 `measuredAt must be an ISO-8601 timestamp with a UTC offset, such as 2026-10-17T14:30:00+08:00.`
10. More than 5 minutes ahead - 400 `measuredAt is more than 5 minutes after the server's time. Check the device's clock.`
11. Inactive estate - 409 `This estate is inactive. Readings are not accepted.` A retired asset does not block readings (ID-44: a device left switched on stays visible as Online), and neither does a deactivated location. Flatline review, failure risk and the dashboard already exclude retired assets.

Values are never judged for plausibility: 150 °C on a pump is stored.

## Duplicates, conflicts and order (decision 0028)

- A reading is keyed by device, metric and `measuredAt` (unique index on `DeviceReading`).
- `measuredAt` is normalised to UTC and truncated to microseconds, so `14:30:00+08:00` and `06:30:00Z` are the same key.
- `value` is rounded half-up to 6 places before storing or comparing, so `21.5` and `21.50` are identical, and `0.30000000000000004` is stored as `0.300000`.
- New key: 201. Same key and value: 200, nothing stored. Same key, different value: 409 `A different value is already stored for TEMPERATURE at 2026-10-17T06:30:00Z. A correction needs a new measuredAt.`, nothing changes.
- Readings older than ones already stored are accepted.
- Concurrent identical submissions: one inserts; the other takes the 200 path (`ON CONFLICT DO NOTHING`, then compares).

## Last seen

A 201 or 200 sets `Device.lastSeenAt` to the server's receipt time (never `measuredAt`), and never moves it backwards. 400, 401 and 409 leave it unchanged. It is shown as `lastSeenAt` on `DeviceResponse`, which derives `status` from it ([device-status.md](device-status.md)). `Device.updatedAt` is not touched.

## Storage

`DeviceReading` is append-only: `id`, `deviceId`, `estateId`, `assetId`, `metric`, `value numeric(18,6)`, `measuredAt`, `receivedAt` (`timestamptz`). No unit column. Composite foreign keys `(deviceId, estateId)` and `(assetId, estateId)` keep a reading in its device's estate.

## Example

```http
POST /device-api/readings
Authorization: Bearer upk_...
Content-Type: application/json

{"metric":"TEMPERATURE","value":48.2,"unit":"°C","measuredAt":"2026-10-17T14:30:00+08:00"}
```

201:

```json
{"id":"8f0c...","deviceId":"2b1e...","assetId":"c4d2...","metric":"TEMPERATURE","value":48.200000,"unit":"°C","measuredAt":"2026-10-17T06:30:00Z","receivedAt":"2026-10-17T06:30:01.204331Z"}
```

## Simulator

`scripts/simulate-pump.py` sends pump readings to a running server with a real key. See the script's `--help`.
