# Device readings

**Status:** draft
**Owner:** ID-43

## Problem

Registered devices (ID-41) have nowhere to send measurements. Maintenance
features need readings stored against the correct asset, and they need
malformed submissions turned away with a reason the device can log.

## Behaviour

- An authenticated device (ID-42) submits one reading per request: `metric`, `value`, `unit` and `measuredAt`.
- An accepted reading is stored against the device and the asset the device is linked to when the reading arrives.
- Validation checks the payload, not measurement accuracy. An unusual value, such as 150 °C on a pump, is accepted because it may be a real fault.
- Each rejection returns a message that names the field and the problem. Checks run in this order, and the first failure is returned:
  1. The body is not a JSON object - 400.
  2. A field is missing or null - 400, for example `metric is required.`
  3. A field the API does not define is present - 400. A device that sends `deviceId` is told it is not accepted rather than having it silently ignored.
  4. `value` is not a JSON number. Strings such as `"21.5"` and booleans are rejected, not converted - 400.
  5. `value` has more than 12 digits before the decimal point - 400.
  6. `metric` is not in the catalogue (decision 0016) - 400, listing the supported metrics.
  7. `metric` is in the catalogue but not registered for this device - 400.
  8. `unit` is not exactly the catalogue unit for the metric - 400, stating the expected unit, for example `unit for TEMPERATURE must be °C; got C.`
  9. `measuredAt` is not an ISO-8601 timestamp with a UTC offset - 400.
  10. `measuredAt` is more than 5 minutes after the server's receipt time - 400.
  11. The device's asset is retired, or its estate is inactive - 409.
- Duplicates, conflicts and out-of-order readings (decision 0026):
  - A reading whose device, metric and `measuredAt` match nothing stored is saved - 201.
  - An identical retry, with the same device, metric, `measuredAt` and value, saves nothing and returns the stored reading - 200.
  - A different value for the same device, metric and `measuredAt` is rejected and nothing changes - 409.
  - A valid reading older than ones already stored is accepted.
- A 201 or 200 sets the device's last-seen time to the server's receipt time, never to `measuredAt`. Last-seen never moves backwards. A 400, 401 or 409 does not change it.

## Data

New Prisma model `DeviceReading`, append-only, with no `updatedAt`:

- `id`, `deviceId`, `estateId`, `assetId`, `metric` (catalogue name), `value Decimal @db.Decimal(18, 6)`, `measuredAt` and `receivedAt` (`timestamptz`).
- `@@unique([deviceId, metric, measuredAt])` enforces the duplicate rule.
- Composite foreign keys carry `estateId`: `(deviceId, estateId)` to `Device`, which gains `@@unique([id, estateId])`, and `(assetId, estateId)` to `Asset`.
- `assetId` records the asset at receipt time. If ID-45 later moves a device, its earlier readings stay with the original asset.
- There is no `unit` column. The unit is fixed by the metric (decision 0016).

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | /device-api/readings | CreateReadingRequest | 201 / 200 ReadingResponse | Device key |

`CreateReadingRequest`: `metric`, `value`, `unit`, `measuredAt`.
`ReadingResponse`: `id`, `deviceId`, `assetId`, `metric`, `value`, `unit`,
`measuredAt`, `receivedAt`. A 200 returns the reading already stored, with its
original `receivedAt`. Errors use the existing `{ "message": ... }` body.

## Edge cases

- `measuredAt` values in different offsets that are the same instant (`...T14:30:00+08:00` and `...T06:30:00Z`) are the same timestamp.
- Values are compared numerically after rounding to 6 decimal places, so `21.5` and `21.50` are identical.
- Two identical submissions arriving at the same moment: the unique index lets one insert, and the other becomes the 200 path.
- A reading that arrives while its asset is being retired may be accepted if it is read before the retirement commits. No row lock is taken, so readings do not queue behind each other.
- Units are compared exactly. `°C` must be sent as UTF-8, and `C` or `degC` is rejected.

## Out of scope

- Batch submissions.
- Reading history views, exports, rollups, retention and anomaly detection.
- A live simulated-pump demo. For now, an integration test that behaves as a pump covers the flow: it sends a valid reading, an identical retry, a conflicting reading and an invalid unit with a real issued key, then checks the stored rows and the last-seen time.
