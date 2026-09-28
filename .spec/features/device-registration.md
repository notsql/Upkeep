# Device registration

**Status:** built
**Owner:** ID-41

## Problem

Readings from on-site sensors cannot be attributed to equipment until the
system knows which device measures which asset, where it is, and what it
reports. Without that record, ID-43 has nothing to validate readings against
and ID-44 has no expected interval to judge silence by.

## Behaviour

- An estate owner can register a device against an active asset in an active estate.
- A device records an identifier, model, asset, location, supported metrics, and an expected reporting interval in seconds.
- Metrics come from a fixed catalogue, and each metric has exactly one unit: temperature °C, humidity %, pressure bar, flow rate L/min, vibration mm/s, power kW, energy kWh.
- Identifier, model, location, at least one metric and the interval are required. The interval is 1 to 86,400 seconds (one day).
- The device's location must be an active location in the asset's estate. It defaults to the asset's location in the form, but can be any other location in that estate.
- A location or asset from another estate is rejected as not found. The database also refuses such a row.
- Identifiers are unique across all estates. A duplicate is rejected with 409 and an explanation naming the identifier, without revealing which estate holds it.
- A newly registered device has no last-seen time and is shown as Awaiting first reading.
- The asset page lists the asset's devices with their metrics, units, interval and status.
- Registering on a deactivated asset or an inactive estate returns 409. An unknown asset, or an estate the caller does not own, returns 404.

## Data

New Prisma model `Device`: UUID ID, `estateId`, `assetId`, `locationId`, a
globally unique `identifier`, `model`, `metrics` (an array of catalogue names),
`reportingIntervalSeconds`, nullable `lastSeenAt`, and created and updated
timestamps. The foreign keys to `Asset` and `Location` both include `estateId`,
so Postgres rejects a device, asset and location from different estates.
`Asset` gains `@@unique([id, estateId])` to be the target of that key, as
`Location` already is. See decision 0016.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/assets/{assetId}/devices | - | DeviceResponse[] | Owner |
| POST | /estates/{estateId}/assets/{assetId}/devices | CreateDeviceRequest | 201 DeviceResponse | Owner |

`DeviceResponse.metrics` lists each metric with its unit, so later stories and
the UI never guess units.

## Edge cases

- Identifiers are trimmed, then compared exactly. `PUMP-01` and `pump-01` are different devices.
- Two simultaneous registrations with the same identifier: one wins, and the unique index turns the other into a 409.
- Duplicate metrics in a request are collapsed.
- A deactivated location, including the asset's own, cannot be chosen.
- The form keeps what was entered when the server rejects it, for example after a duplicate identifier.

## Out of scope

- Device credentials and authentication (ID-42).
- Receiving readings and updating last-seen (ID-43, ID-44).
- Online and offline status (ID-44).
- Editing, deactivating or replacing devices (ID-45).
- Letting estate users view devices. Assets and locations are still owner-only.
