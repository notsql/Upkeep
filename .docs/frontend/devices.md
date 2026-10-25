# Devices (frontend)

IoT devices registered to an asset. Paths are relative to `apps/web/src/`.

## Routes

`/estates/$estateId/devices` (`routes/_auth/estates/$estateId/devices/index.tsx`,
title "Devices") renders `EstateDevicesPage` from its adjacent `-components/`.
Linked as "Devices" from the estate page's actions for Managers
(`estate.owned || estate.canManageInvitationPermissions`), active or inactive estate.

`AssetDevicesSection` renders on the asset details page,
`/estates/$estateId/assets/$assetId`
(`routes/_auth/estates/$estateId/assets/$assetId/index.tsx`, see
[assets.md](assets.md)). Requires sign-in.

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `EstateDevicesPage` (`devices/-components/estate-devices-page.tsx`) | PageHeader (Estates › Estate › Devices), "Refreshes every 60 seconds while this page is open." A table labelled "Devices" in the server's order (Offline, Awaiting first reading, Online): Device (`identifier`, `model`), Asset (link "`assetName`" to the asset page, `assetReference`, "Retired" badge when `assetRetired`), Location (path from `useLocations`, or "Location unavailable"), Last seen (`toLocaleString` in a `<time>`, or "Never"), Status (`DeviceStatusBadge`). Loading: "Loading devices…"; empty: "No devices are registered in this estate yet."; errors as a destructive Alert. | `Table`, `Badge`, `Alert` |
| `DeviceStatusBadge` (`components/device-status-badge.tsx`, shared) | "Online" (secondary), "Offline" (destructive), "Awaiting first reading" (outline). | `Badge` |

All three files are in `routes/_auth/estates/$estateId/assets/$assetId/-components/`.

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `AssetDevicesSection` (`asset-devices-section.tsx`) | "Devices" section. "Register device" link when `canRegister`, leading to the dedicated registration page. Lists devices: `identifier`, a "Last seen {date}" badge when it has reported and a `DeviceStatusBadge`, model, location path (from `useLocations`, or "Location unavailable"), metrics as `Name (unit)` using the API's unit, reporting interval via `formatInterval`, then `DeviceCredential` per device (`canManage` = `canRegister`). Empty: "No devices are registered to this asset yet." Registration is handled by NewDevicePage. | `buttonVariants`, `Badge` |
| `DeviceCredential` (`device-credential.tsx`) | "Credential issued {date}" (`credentialIssuedAt`, `toLocaleString`) or "No credential". When `canManage` (asset active): "Generate credential" (issues at once) or "Replace credential" (first opens a confirm dialog saying the current key stops working immediately, with Cancel / "Replace credential"). The new key shows once in a dialog: read-only "API key" input, "Copy" (`navigator.clipboard.writeText`, toast "API key copied."), the warning "It won't be shown again", and "Done". The key lives only in component state and is dropped when the dialog closes; it is never put in the query cache. Errors show as `role="alert"`. | `Button`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Input`, `Label` |
| `DeviceForm` (`device-form.tsx`) | Fields: `identifier` (req, max 100), `model` (req, max 200), `locationId` (req select of `flattenLocations` paths, defaults to the asset's location), "Supported metrics" checkbox group (at least one), `interval` "Expected reporting interval (seconds)" (req, whole number 1-86400, default 60). Fields are grouped into Device identity, Location, Supported metrics and Reporting. Cancel returns to the asset; both submit/Cancel disable while pending. Metric choices are bordered, labelled touch targets with names/units. Metrics are sent in catalogue order. Checkboxes take `disabled={pending}` explicitly, since a disabled fieldset does not disable them. | `Button`, `Checkbox`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |

Registration route: `/estates/$estateId/assets/$assetId/devices/new`, implemented
by `devices/new/index.tsx` and its adjacent `-components/new-device-page.tsx`.
`NewDevicePage` uses PageHeader, named estate/asset breadcrumbs and a form surface.
It loads `useEstate` and `useAsset`, permits registration only for the owner on an
active estate/asset, and shows loading/errors or a denial for direct links.
`useRegisterDevice` saves through the existing endpoint; success shows the
existing toast and navigates back to asset details, where the device query is
invalidated. Cancel makes no registration request. Errors retain form input.

## Data (`lib/devices.ts`)

Types: `Device` = `DeviceResponse` (includes nullable `credentialIssuedAt` and required `status`),
`EstateDevice` = `EstateDeviceResponse`, `DeviceStatus` = `Device["status"]`,
`DeviceCredential` = `DeviceCredentialResponse` (`deviceId`, `apiKey`, `issuedAt`), `DeviceInput` = `CreateDeviceRequest`
(`identifier`, `model`, `locationId`, `metrics`, `reportingIntervalSeconds`),
`DeviceMetric`.

Constants: `deviceMetrics` (catalogue, in server order): `TEMPERATURE` °C,
`HUMIDITY` %, `PRESSURE` bar, `FLOW_RATE` L/min, `VIBRATION` mm/s,
`VIBRATION_ACCELERATION` "Vibration acceleration" g, `POWER` kW,
`ENERGY` kWh. `MAX_REPORTING_INTERVAL_SECONDS = 86_400`.
`formatInterval(s)` gives "Every second" / "Every N seconds".

Query key: `devicesQueryKey(userId, estateId, assetId)` =
`["estates", userId, "devices", estateId, assetId]`.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useDevices(estateId, assetId)` | `GET /estates/{estateId}/assets/{assetId}/devices` | query |
| `useEstateDevices(estateId)` | `GET /estates/{estateId}/devices` | query, key `estateDevicesQueryKey(userId, estateId)` = `["estates", userId, "estate-devices", estateId]`; `refetchInterval: 60_000`, not in the background |
| `useRegisterDevice(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/devices` | invalidate `devicesQueryKey(...)` |
| `useIssueDeviceCredential(estateId, assetId)`, `mutate(deviceId)` | `POST /estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential` | invalidate `devicesQueryKey(...)` |

Credential generation and replacement use the generated API contract. Spring's JWT security chain explicitly permits this POST endpoint, and the service enforces estate ownership.

Also reads `useLocations(estateId)` (key `["estates", userId, "locations",
estateId]`) for the location select and path labels. All queries:
`enabled: ready`, `retry: false`, errors via `estateError`.

## Dashboard presentation

Devices is a separate themed surface on asset details with a wrapping section
action row. Device metadata uses responsive columns; identifiers/models wrap.
Shared shadcn form controls and dialog styling follow
[design-system.md](design-system.md). Registration, metrics and read/write
permissions are unchanged; device registration has a dedicated contextual route, without a sidebar item.
