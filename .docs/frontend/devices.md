# Devices (frontend)

IoT devices registered to an asset. Paths are relative to `apps/web/src/`.

## Routes

No route of its own. `AssetDevicesSection` renders on the asset details page,
`/estates/$estateId/assets/$assetId`
(`routes/_authenticated/estates/$estateId/assets/$assetId/index.tsx`, see
[assets.md](assets.md)). Requires sign-in.

## Screens and components

Both files are in `routes/_authenticated/estates/$estateId/assets/$assetId/-components/`.

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `AssetDevicesSection` (`asset-devices-section.tsx`) | "Devices" section. "Register device" button when `canRegister` (asset active) and the form is closed. Lists devices: `identifier`, status badge ("Last seen {date}" or "Awaiting first reading"), model, location path (from `useLocations`, or "Location unavailable"), metrics as `Name (unit)` using the API's unit, reporting interval via `formatInterval`. Empty: "No devices are registered to this asset yet." On save: close form, toast "Device registered. It is awaiting its first reading." | `Button` |
| `DeviceForm` (`device-form.tsx`) | Fields: `identifier` (req, max 100), `model` (req, max 200), `locationId` (req select of `flattenLocations` paths, defaults to the asset's location), "Supported metrics" checkbox group (at least one), `interval` "Expected reporting interval (seconds)" (req, whole number 1-86400, default 60). Metrics are sent in catalogue order. Checkboxes take `disabled={pending}` explicitly, since a disabled fieldset does not disable them. | `Button`, `Checkbox`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |

## Data (`lib/devices.ts`)

Types: `Device` = `DeviceResponse`, `DeviceInput` = `CreateDeviceRequest`
(`identifier`, `model`, `locationId`, `metrics`, `reportingIntervalSeconds`),
`DeviceMetric`.

Constants: `deviceMetrics` (catalogue, in server order): `TEMPERATURE` °C,
`HUMIDITY` %, `PRESSURE` bar, `FLOW_RATE` L/min, `VIBRATION` mm/s, `POWER` kW,
`ENERGY` kWh. `MAX_REPORTING_INTERVAL_SECONDS = 86_400`.
`formatInterval(s)` gives "Every second" / "Every N seconds".

Query key: `devicesQueryKey(userId, estateId, assetId)` =
`["estates", userId, "devices", estateId, assetId]`.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useDevices(estateId, assetId)` | `GET /estates/{estateId}/assets/{assetId}/devices` | query |
| `useRegisterDevice(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/devices` | invalidate `devicesQueryKey(...)` |

Also reads `useLocations(estateId)` (key `["estates", userId, "locations",
estateId]`) for the location select and path labels. All queries:
`enabled: ready`, `retry: false`, errors via `estateError`.
