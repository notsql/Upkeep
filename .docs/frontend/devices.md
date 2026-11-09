# Devices (frontend)

IoT devices registered to an asset. Paths are relative to `apps/web/src/`.

## Routes

`/estates/$estateId/devices` (`routes/_auth/estates/$estateId/devices/index.tsx`)
is retired: its `beforeLoad` redirects (`replace: true`) to
`/estates/$estateId/assets/devices` (All sensors, below). The old
`EstateDevicesPage` is deleted.

`AssetDevicesSection` renders on the asset details page,
`/estates/$estateId/assets/$assetId`
(`routes/_auth/estates/$estateId/assets/$assetId/index.tsx`, see
[assets.md](assets.md)). Requires sign-in.

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `DeviceStatusBadge` (`components/badges/device-status-badge.tsx`, shared) | "Online" (`success` green, same as an active asset), "Offline" (`danger`), "Awaiting first reading" (`neutral`), "Deactivated" (`muted`, ID-45), on the outline `Badge` with classes from `lib/status-tone.ts`; also exports `deviceStatusTone`. | `Badge` |

All four files are in `routes/_auth/estates/$estateId/assets/$assetId/-components/`.

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `AssetDevicesSection` (`asset-devices-section.tsx`) | "Devices" `PageSection` (`RadioTower`, not the sidebar's `Cpu`; no card) on the asset's Devices sub-page (`/assets/$assetId/devices`); header actions (`sectionActionClassName`) "Readings" (`Activity`) and "Add sensor" (`Plus`, when `canRegister`), leading to the dedicated registration page. Then the devices as a divided `ul aria-label="Devices"` of `DeviceItem` rows (`canManage` = `canRegister`). Empty: "No devices yet" (`EmptyState`; description "Use Add sensor to add the first sensor" when `canRegister`, else "Registered sensors appear here"; no action - the header's Add sensor is the entry point). A load error is an `ErrorState` (Retry). Registration is handled by NewDevicePage. | `buttonVariants`; `PageSection`, `EmptyState`, `ErrorState`, `LoadingState` |
| `DeviceItem` (`device-item.tsx`) | One device row (ID-45), no nested card. Left: a status dot (`statusDotClassName[deviceStatusTone[status]]`, `aria-hidden`). Then an `h3` identifier, `DeviceStatusBadge` (or secondary "Deactivated {formatDateTime}" for a deactivated device), and muted "Last seen {formatRelative}" with `title` = `formatDateTime(lastSeenAt)` once it has reported. A muted meta line: model · location path (from `useLocations`, or "Location unavailable") · "Reports every N seconds" (`formatInterval`). Metrics as small outline `Badge` chips "Name (unit)". "Replaces {identifier}" / "Replaced by {identifier}" from `replacesDeviceId` / `replacedByDeviceId`. Active devices show muted "Credential issued {formatDateTime}" or "No credential". When the asset is active and owned (`canRegister`) and the device active: a ghost icon `DropdownMenu` trigger (`MoreHorizontal`, `aria-label` "Actions for {identifier}") with items "Get connection key" / "Replace connection key" (`KeyRound`), "Replace device" (`Replace`, a `Link` to the replace route), a separator, and destructive "Turn off sensor" (`PowerOff`) opening `DeactivateDeviceDialog`. Deactivated devices have no menu. Success toast "Device deactivated. Its readings are kept." | `Badge`, `Button`, `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` |
| `DeactivateDeviceDialog` (`deactivate-device-dialog.tsx`) | Dialog "Turn off {identifier}?": key stops working, permanent, readings stay. The shared `ConfirmDialog`: the "Device identifier" input must equal the identifier exactly before "Turn off sensor" enables (`confirmDisabled`). "Deactivating…" while pending; errors in `role="alert"`; pending blocks dismissal. | `ConfirmDialog`, `Input`, `Label` |
| `useDeviceCredential` + `DeviceCredentialDialogs` (`device-credential.tsx`) | The credential flow behind the row menu's credential item: `actionLabel` is "Get connection key" (issues at once) or "Replace connection key" (`start` first opens the shared `ConfirmDialog` "Replace the credential for {identifier}?" saying the current key stops working immediately, with Cancel / destructive "Replace connection key"). The new key shows once in a dialog: read-only "API key" input, "Copy" (`navigator.clipboard.writeText`, toast "API key copied."), the warning "It won't be shown again", and "Done". The key lives only in the hook's state and is dropped when the dialog closes; it is never put in the query cache. Errors show as `role="alert"`. | `Button`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Input`, `Label` |
| `DeviceForm` (`device-form.tsx`) | Fields: `identifier` (req, max 100), `model` (req, max 200), `locationId` (req select of `flattenLocations` paths, defaults to the asset's location), "Supported metrics" checkbox group (at least one), `interval` "Expected reporting interval (seconds)" (req, whole number 1-86400, default 60). Fields are grouped into shadcn `FieldSet`s with `FieldLegend`s - Device identity (identifier and model side by side from `sm`), Location, Supported metrics and Reporting - separated by `FieldSeparator`s; each field is `Field` + `FieldLabel`. Form errors are a destructive `Alert`; the footer is `FormActions`. Cancel returns to the asset; both submit/Cancel disable while pending. Metric choices are bordered, labelled touch targets with names/units. Metrics are sent in catalogue order. Checkboxes take `disabled={pending}` explicitly, since a disabled fieldset does not disable them. State and validation live in `use-device-form.ts`; each fieldset is its own section (`device-form-identity-fields.tsx`, `device-form-location-field.tsx`, `device-form-metrics-fields.tsx`, `device-form-reporting-field.tsx`, errors via `device-form-field-error.tsx`). | `FormActions`, `Alert`, `Checkbox`, `Field`, `FieldLabel`, `FieldLegend`, `FieldSet`, `FieldSeparator`, `Input`, `Label` (metric options), `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |

`DeviceForm` also takes `initialDevice` (`model`, `locationId`, `metrics`, `reportingIntervalSeconds`; the identifier always starts empty), `submitLabel` (default "Add sensor") and `pendingLabel` (default "Registering…").

Replace route (ID-45): `/estates/$estateId/assets/$assetId/devices/$deviceId/replace`,
implemented by `devices/$deviceId/replace/index.tsx` and its adjacent
`-components/replace-device-page/replace-device-page.tsx` (state in `use-replace-device-page.ts`, form card in `replace-device-form-card.tsx`). `ReplaceDevicePage` finds the device in
`useDevices`, titles itself "Replace {identifier}", says the old device will be
deactivated and its key stop working, and renders `DeviceForm` prefilled from it
with "Replace device" / "Replacing…". Only the owner, on an active estate and
asset, for an active device; otherwise an alert ("already deactivated", "not
found" or not allowed). Success toasts a reminder to generate the new device's
credential and returns to the asset's Devices sub-page (`/assets/$assetId/devices`), as does Cancel, which sends nothing. The page is a `FormPage` (no icon); the form sits in a `FormCard` that opens with an `Alert` explaining that the old device is deactivated and its key stops working. Loading and errors render inside the `FormPage`.

Registration route: `/estates/$estateId/assets/$assetId/devices/new`, implemented
by `devices/new/index.tsx` and its adjacent `-components/new-device-page.tsx`.
`NewDevicePage` is a `FormPage` ("Measurements and reporting interval"; no icon), breadcrumbs `Assets › <asset name> › Add sensor`, with `DeviceForm` in a `FormCard` (the standard: [design-system.md#forms-formpage-formcard-formactions](design-system.md#forms-formpage-formcard-formactions)). Loading, errors and the denial render inside the `FormPage`.
It loads `useEstate` and `useAsset`, permits registration only for the owner on an
active estate/asset, and shows loading/errors or a denial for direct links.
`useRegisterDevice` saves through the existing endpoint; success shows the
existing toast and navigates back to the asset's Devices sub-page, where the device query is
invalidated. Cancel returns there too. Cancel makes no registration request. Errors retain form input.

## All sensors (Assets › All sensors)

Route `assets/devices/index.tsx` → `/estates/$estateId/assets/devices`, title
"All sensors", renders `AllDevicesPage`. Components live in
`assets/devices/-components/all-devices-page/`; the metric-policy components
live in `assets/devices/-components/metric-policy-settings/`. `/devices`,
`/sensors` and `/sensors/all` redirect here.

Gate: `canOpenAllDevices` (`canOpenDevices ∪ canOpenSensors`) in
`lib/estate-destinations.ts`, enforced by the `_auth` guard (owner, Manager,
Council; not Crew, residents or inspection-only readers), even without
`canViewAssets`. The sidebar's Assets item lands here for viewers who cannot
open By location (`assetsEntry`); others reach it from `AssetViewsNav`.

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `AllDevicesPage` (`all-devices-page.tsx`) | `ListPageHeader` (`Cpu`, "All sensors", "Every sensor, most urgent first"; action `MetricPoliciesDialog`), `AssetViewsNav`, then the results. Access from `useAssetViewsAccess`: `devices` (owner or `MANAGER`, the estate devices endpoint's audience) and `review` (`canOpenSensors`). Viewers without `review` get `EmptyState` "No device view". | `ListPageHeader`, `LoadingState`, `EmptyState` |
| `AllDevicesResults` (same file) / `useAllDevicesPage` (`use-all-devices-page.ts`) | Joins `useEstateDevices` (only when `devices`; Council never requests `/devices`) with `useAllFlatlineReview(estateId, "ALL")` and ranks with `rankDevices` from `lib/asset-monitoring.ts`. Table skeleton until both sources settle; the rank is then held (polling refreshes cells, not order; new devices append), and recomputed only after the user's Retry changes a source's outcome. Each failed source shows its own `ErrorState` (`Retry devices` / `Retry device monitoring`); a failed review leaves the rows ranked by device status; a failed device list falls back to review-only rows. Location: the device's location path from `useLocations` (device rows) or `deviceLocationPath` (review rows). `PauseSensorDialog` opens for the chosen metric when `canManage` (review `canManage && estateActive`, and the viewer has `devices`). | `ErrorState`, `EmptyState` |
| `AllDevicesTable` (`all-devices-table.tsx`) | Table "All sensors": Device (row header: identifier, model), Asset (link to the asset when `canOpenAssets`, else text; reference; "Retired"), Location, Last seen and Status (`DeviceStatusBadge`; both only with a device list, so not for Council), Monitoring (per metric `SensorLine`: state badge "Sensor may not be working" / "Paused until <time>" / …, and "Pause warnings" when `canManage`, a threshold is set and the metric is not paused). Deactivated devices show no metrics or actions. | `Table`, `Badge`, `Button` |
| `MetricPoliciesDialog` (`metric-policies-dialog.tsx`) | Outline "When to warn" button opening a `Dialog` (same title) whose content mounts on open: `useFlatlinePolicies`, inactive-estate `Alert`, then `MetricPolicySettings defaultExpanded` (read-only unless policies `canManage && estateActive`, so Council and inactive estates read only). | `Dialog`, `Button`, `Alert` |
| `SensorLine` (`components/sensors/sensor-line.tsx`, shared with the asset Overview) | One measurement of a sensor: name and state badge ("Working", "No warning set", "No readings yet", "Waiting for new readings", "Warnings paused (until <time>)", destructive "Sensor may not be working"). For a sensor that may not be working it adds the reason "It has sent the same reading (<value>) for <duration>." and the next step: a **Replace sensor** link to `…/devices/$deviceId/replace` when `canReplace` (the owner: All sensors passes `withDevices`, never for retired equipment), **Pause warnings** when `canManage`; with neither, `AskSomeoneLine` (`REPLACE_SENSOR`, "replace this sensor"). Pause button `aria-label` "Pause warnings for <identifier> <measurement>". | `Badge`, `Button`, `Link` |

Ranking (`rankDevices(devices | null, sensors)`): Sensor may not be working (any metric
`FLATLINED`) → Offline → Awaiting first reading → Online → Deactivated; ties by
asset name, then identifier. Paused metrics do not raise a device. With `null`
devices, rows are built from review entries (status `null`, ranked as Online
unless flatlined). The ALL review view is used (not REVIEW) so every metric can
be paused before a flag, as the retired `/sensors/all` allowed; FLATLINED entries are the
same in both.

## Data (`lib/devices.ts`)

`useAssetViewsAccess(estateId)` (uses `useAppAccess`, and `useEstate` only
when `canViewManagement || canViewAssets`, so Crew never request
`GET /estates/{id}`) returns
`{ pending, register, assetPages, allDevices, devices, review, allReadings }`:
`register` = `canViewAssets`, `assetPages` = `canOpenAssets`, `allDevices` =
`canOpenAllDevices`, `devices` = owner or `MANAGER`, `review` =
`canOpenSensors`, `allReadings` = `canOpenAllReadings`. Used by
`AssetViewsNav` and `AllDevicesPage`.

Types: `Device` = `DeviceResponse` (includes nullable `credentialIssuedAt`, `deactivatedAt`, `replacesDeviceId`, `replacedByDeviceId` and required `status`),
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
| `useDevices(estateId, assetId, enabled = true)` | `GET /estates/{estateId}/assets/{assetId}/devices` | query; `activeDevices(devices)` drops deactivated ones (used by the asset tab count and the Overview's devices-online stat) |
| `useEstateDevices(estateId, enabled = true)` | `GET /estates/{estateId}/devices` | query (`enabled` lets the asset register skip it for viewers the endpoint does not serve; also feeds the register's device summary column, see assets.md), key `estateDevicesQueryKey(userId, estateId)` = `["estates", userId, "estate-devices", estateId]`; `refetchInterval: 60_000`, not in the background |
| `useRegisterDevice(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/devices` | invalidate `devicesQueryKey(...)` |
| `useIssueDeviceCredential(estateId, assetId)`, `mutate(deviceId)` | `POST /estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential` | invalidate `devicesQueryKey(...)` |
| `useDeactivateDevice(estateId, assetId)`, `mutate({ deviceId, identifier })` | `POST /estates/{estateId}/assets/{assetId}/devices/{deviceId}/deactivate` | invalidate `devicesQueryKey(...)` |
| `useReplaceDevice(estateId, assetId, deviceId)`, `mutate(DeviceInput)` | `POST /estates/{estateId}/assets/{assetId}/devices/{deviceId}/replace` | invalidate `devicesQueryKey(...)` |

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
