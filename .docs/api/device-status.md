# Device status API

Contract: `packages/api/openapi.json`. Spec: `.spec/features/device-status.md`.
Decision: 0027 (status is derived on read).

## Status rule

Every `DeviceResponse` and `EstateDeviceResponse` carries a required `status`,
calculated by Spring on each read from `lastSeenAt`, `reportingIntervalSeconds`
and the server's injected `Clock` (`DeviceStatus.of`). It is never stored.

- `AWAITING_FIRST_READING`: `lastSeenAt` is null.
- `ONLINE`: silence (`now - lastSeenAt`) is at most the offline threshold.
- `OFFLINE`: silence is more than the offline threshold.

Offline threshold = max(3 × `reportingIntervalSeconds`, 5 minutes). At exactly
the threshold a device is Online; one second later it is Offline. Every 60 s
→ Offline after 5 min; every 10 min → Offline after 30 min.

`lastSeenAt` is the server's receipt time of the latest valid reading (see
[device-readings.md](device-readings.md#last-seen)). A valid reading returns an
Offline device to Online. Readings for a retired asset are accepted, so a device
on a retired asset still shows Online while it reports. A deactivated device
(ID-45) is `DEACTIVATED`, which takes precedence over the reporting rule, so it
never shows as Offline; it is listed after every active device.

## GET `/estates/{estateId}/devices`

- Auth: estate Manager - the owner or a `MANAGER` member (`EstateRepository.findManaged`). Readable on an inactive estate.
- path `estateId`: uuid (required)
- 200: every device in the estate, retired assets included - EstateDeviceResponse[]. Order: `OFFLINE`, then `AWAITING_FIRST_READING`, then `ONLINE`, then `DEACTIVATED`; within a group the oldest `lastSeenAt` first, then `identifier`. Empty array when there are none.
- 401: Sign in required - EstateError
- 403: Caller is a resident of the estate - EstateError
- 404: Estate not found, or the caller is not a Manager (council, crew, member, stranger) - EstateError

## EstateDeviceResponse

`DeviceResponse` (see [assets.md](assets.md#deviceresponse)) plus the asset.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| estateId | uuid | yes |  |
| assetId | uuid | yes |  |
| assetReference | string | yes |  |
| assetName | string | yes |  |
| assetRetired | boolean | yes | The asset is retired; the device is not deactivated by this |
| locationId | uuid | yes | The device's location; the web app resolves the path |
| identifier | string | yes |  |
| model | string | yes |  |
| metrics | DeviceMetricResponse[] | yes |  |
| reportingIntervalSeconds | int32 | yes |  |
| lastSeenAt | date-time | no | null until the first valid reading |
| status | AWAITING_FIRST_READING / ONLINE / OFFLINE / DEACTIVATED | yes | See status rule |
| credentialIssuedAt | date-time | no |  |
| createdAt | date-time | yes |  |
| updatedAt | date-time | yes |  |

Example: `GET /estates/{estateId}/devices` returns 200

```json
[{"id":"…","estateId":"…","assetId":"…","assetReference":"MG-A0001",
  "assetName":"Booster pump","assetRetired":false,"locationId":"…",
  "identifier":"PUMP-01","model":"PT-100",
  "metrics":[{"metric":"PRESSURE","unit":"bar"}],"reportingIntervalSeconds":60,
  "lastSeenAt":"2026-10-24T08:30:00Z","status":"OFFLINE",
  "credentialIssuedAt":"2026-10-20T02:00:00Z",
  "createdAt":"2026-10-20T01:00:00Z","updatedAt":"2026-10-20T02:00:00Z"}]
```
