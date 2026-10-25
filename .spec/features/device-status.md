# Device reporting status

**Status:** accepted (2026-10-24)
**Owner:** ID-44

## Problem

A device that stops reporting is silent. A manager cannot tell a quiet pump
from a dead sensor, and has no single place to find devices whose monitoring
data has stopped.

## Behaviour

- Each device has a reporting status, calculated by the server whenever a device is read (decision 0027). The offline threshold is 3 times the device's reporting interval or 5 minutes, whichever is longer.
  - Awaiting first reading - no valid submission has ever arrived (`lastSeenAt` is null).
  - Online - the time since `lastSeenAt` is at most the offline threshold.
  - Offline - the time since `lastSeenAt` is more than the offline threshold.
- Last-seen is the server's receipt time of the latest valid submission, never the device's `measuredAt`. This is already built (`ReadingRepository.markSeen`, ID-43) and is not changed here; this story adds tests that pin it.
- An Offline device returns to Online as soon as a valid submission arrives.
- Status uses the server's clock only (an injected `Clock`).
- A Manager of the estate (its owner, or a member with the MANAGER role) has a Devices page for the estate. It lists every device with its identifier, model, linked asset (reference and name), location, last-seen time and status.
- The Devices page lists Offline devices first, then Awaiting first reading, then Online. Within each group, the device silent longest comes first, then by identifier.
- Devices on retired assets are listed with the asset marked Retired. Retiring an asset does not deactivate its devices.
- Readings for a retired asset are now accepted, stored and update last-seen like any other valid submission, so a device left powered on after its asset is retired shows as Online and can be found. This changes ID-43, which rejected them with 409 (`device-readings.md` rule 11). Flatline detection, failure risk and the dashboard already exclude retired assets, so these readings raise nothing; they appear only in that asset's reading history.
- Readings for an inactive estate are still rejected with 409, unchanged.
- The page refreshes about every 60 seconds while open, so a device going offline appears without a reload.
- The asset page's device list shows the same status. Managers can read that list too; it is currently owner-only (`findOwned`), so it changes to Manager access. Registering devices and issuing credentials stay as they are.
- The estate page links to Devices for Managers only (`canManageInvitationPermissions`, which is the Manager check).

## Data

No schema change. Status is not stored.

`ReadingService.submit` drops the retired-asset check. `ReadingRepository.findDevice`
no longer needs the asset's `deactivatedAt` for this; remove it if nothing else reads it.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/devices | - | EstateDeviceResponse[] | Manager |
| GET | /estates/{estateId}/assets/{assetId}/devices | - | DeviceResponse[] | Manager (was Owner) |

`DeviceResponse` gains a required `status`: `AWAITING_FIRST_READING`,
`ONLINE` or `OFFLINE`. `EstateDeviceResponse` is
`DeviceResponse` plus `assetReference`, `assetName` and `assetRetired`. The web
app turns `locationId` into a location path from the locations it already loads.

The device reading endpoint keeps its shape; its 409 description drops "or the
asset is retired".

## Edge cases

- The boundary: at exactly the threshold the device is Online, and one second later it is Offline.
- A device reporting every 60 seconds goes Offline after 5 minutes of silence, not 3; one reporting every 10 minutes goes Offline after 30 minutes.
- Status is computed from the interval stored now. If ID-45 lets the interval change, the status reflects the new interval immediately.
- A reading for a retired asset returns 201 (or 200 for a duplicate) and moves last-seen; the device is Online.
- A retired asset that is restored keeps the readings it received while retired.
- An estate with no devices shows an empty state, not an error.
- An inactive estate's Devices page is still readable.
- An estate the caller does not manage returns 404, including one where they are council or crew. A resident gets 403, as on every other estate management endpoint.

## Out of scope

- Deactivated devices. A device is deactivated only when someone switches that device off, which arrives with ID-45; it will add a Deactivated status that takes precedence over the reporting rule. This acceptance criterion is deferred there.
- Notifications or alerts when a device goes offline (decision 0027).
- Filters and search on the Devices page.
- Council members viewing device status.
- Historical reading views, exports, rollups, retention and anomaly detection.
