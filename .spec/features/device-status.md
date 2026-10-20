# Device reporting status

**Status:** draft
**Owner:** ID-44

## Problem

A device that stops reporting is silent. A manager cannot tell a quiet pump
from a dead sensor, and has no single place to find devices whose monitoring
data has stopped.

## Behaviour

- Each device has a reporting status, calculated by the server whenever a device is read (decision 0027):
  - Awaiting first reading - no valid submission has ever arrived (`lastSeenAt` is null).
  - Online - the time since `lastSeenAt` is at most 3 times the device's reporting interval.
  - Offline - the time since `lastSeenAt` is more than 3 times the reporting interval.
- Last-seen is the server's receipt time of the latest valid submission (ID-43), never the device's `measuredAt`.
- An Offline device returns to Online as soon as a valid submission arrives.
- Status uses the server's clock only.
- An estate owner has a Devices page for the estate listing every device with its identifier, model, linked asset (reference and name), location, last-seen time and status.
- The Devices page lists Offline devices first, then Awaiting first reading, then Online. Within each group, the device silent longest comes first, then by identifier.
- Devices on retired assets are listed with the asset marked Retired. Their readings are rejected (ID-43), so they become Offline.
- The page refreshes about every 60 seconds while open, so a device going offline appears without a reload.
- The asset page's device list shows the same status.
- The estate page links to Devices for owners only.

## Data

No schema change. Status is not stored.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/devices | - | EstateDeviceResponse[] | Owner |

`DeviceResponse` gains a required `status`: `AWAITING_FIRST_READING`,
`ONLINE` or `OFFLINE`. `EstateDeviceResponse` is `DeviceResponse` plus
`assetReference`, `assetName` and `assetRetired`. The web app turns
`locationId` into a location path from the locations it already loads.

## Edge cases

- The boundary: at exactly 3 times the interval the device is Online, and one second later it is Offline.
- Status is computed from the interval stored now. If ID-45 lets the interval change, the status reflects the new interval immediately.
- An estate with no devices shows an empty state, not an error.
- An inactive estate's Devices page is still readable.
- An estate the caller does not own returns 404.

## Out of scope

- Telling deactivated devices apart from offline ones. Devices cannot be deactivated until ID-45, so this acceptance criterion is deferred there.
- Notifications or alerts when a device goes offline (decision 0027).
- Filters and search on the Devices page.
- Council members viewing device status.
