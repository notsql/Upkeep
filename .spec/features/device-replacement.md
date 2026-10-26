# Device deactivation and replacement

**Status:** built
**Owner:** ID-45

## Problem

When a sensor fails, is removed or is swapped for new hardware, there is no
way to retire it. Its API key keeps working, flatline monitoring keeps
watching it, and a replacement on the same asset has no visible link to the
device it took over from. The asset's readings must survive all of this.

## Behaviour

**Deactivate**
- An estate owner can deactivate a device on an active asset in an active estate. The owner confirms by typing the device's identifier exactly, as for assets and estates.
- Deactivation records when it happened and is permanent: there is no reactivation.
- Deactivation removes the device's API key. From then on, a reading sent with that key is rejected with the same 401 and generic message as any unknown key (decision 0025), so the response does not reveal that the device exists.
- A deactivated device cannot be given a new key (409).
- Deactivating an already deactivated device succeeds and keeps the original time.
- Readings are never deleted or moved. Every accepted reading keeps its original device and asset.

**Replace**
- An estate owner can replace an active device. One action deactivates it and registers a new device on the same asset.
- The new device needs its own identifier. Identifiers stay unique across all devices, including deactivated ones.
- The replacement form starts with the old device's model, location, metrics and reporting interval, and all of them can be changed.
- The new device records which device it replaced. It gets its own key in the existing way (Generate credential), so the old key never works for it.
- Deactivating the old device and registering the new one happen in one transaction: both or neither.

**Display**
- The asset's device list shows deactivated devices, marked "Deactivated" with the date, after the active ones. They have no Generate, Replace or Deactivate actions.
- A replacement shows "Replaces {identifier}", and the device it replaced shows "Replaced by {identifier}".
- The asset's readings page already names each reading's device, so the old and new devices' readings stay distinguishable. No change.
- Flatline monitoring and the estate's sensor list stop including a device once it is deactivated. Past flatline reviews stay.
- A deactivated device's reporting status (ID-44) is `DEACTIVATED`, whatever its last reading. It takes precedence over Online, Offline and Awaiting first reading, so a switched-off device never shows as Offline.
- The estate's Devices page lists deactivated devices last, after Offline, Awaiting first reading and Online, because they need no attention. Their badge reads "Deactivated".

**Errors**
- An unknown device, asset or estate, or one the caller does not own, returns 404.
- A wrong confirmation identifier returns 400.
- A retired asset or an inactive estate returns 409, for both deactivation and replacement.

## Data

`Device` gains:
- `deactivatedAt` (nullable timestamp).
- `replacesDeviceId` (nullable). This is a foreign key to the deactivated device it replaced, on the same asset and estate. It is unique, so a device can be replaced only once.

Deactivation sets `credentialHash` to null. No reading rows change.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | /estates/{estateId}/assets/{assetId}/devices/{deviceId}/deactivate | `{ identifier }` | 200 DeviceResponse | Owner |
| POST | /estates/{estateId}/assets/{assetId}/devices/{deviceId}/replace | CreateDeviceRequest (the new device) | 201 DeviceResponse (the new device) | Owner |

`DeviceResponse` gains `deactivatedAt`, `replacesDeviceId` and
`replacedByDeviceId`, all nullable. `DeviceStatus` (ID-44) gains
`DEACTIVATED`, on both `DeviceResponse` and `EstateDeviceResponse`. The device list returns active devices
first, then deactivated ones, each newest first.

## Edge cases

- A reading sent at the same moment as deactivation may be accepted if it is checked before the deactivation commits. Credential lookups take no lock, the same trade-off as asset retirement in ID-43.
- Replacing a device that is already deactivated returns 409. Register a new device on the asset instead.
- A replacement's identifier that is already used returns 409 with the existing duplicate message, and the old device stays active.
- An asset with only deactivated devices shows them all, with the usual Register device button.

## Out of scope

- Reactivating a device.
- Moving a device to another asset.
- Changing a device's details in place.
