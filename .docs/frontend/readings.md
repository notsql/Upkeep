# Readings (frontend)

An asset's stored sensor readings with suspect-data flags. Paths are relative
to `apps/web/src/`. API: [../api/readings.md](../api/readings.md).

## Routes

`/estates/$estateId/assets/$assetId/readings`
(`routes/_auth/estates/$estateId/assets/$assetId/readings/index.tsx`, page
title "Readings"). Requires sign-in. Linked from the asset details page by an
outline "Readings" link in `AssetDevicesSection`'s action row
(`$assetId/-components/asset-devices-section.tsx`, see [devices.md](devices.md)),
shown to everyone who can see the section, before "Register device".

### Search params

Filters live in the URL, so a filtered view can be shared. `validateSearch`
drops anything invalid.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `metric` | DeviceMetric | all | Must be a key of `deviceMetrics` |
| `from` | string | none | `datetime-local` value (`YYYY-MM-DDTHH:mm[:ss]`), browser-local time |
| `to` | string | none | As `from` |
| `suspect` | `true` | off | `true` or `"true"`; anything else is dropped |
| `page` | integer | 0 | Only kept when a whole number > 0 |

Any filter change (metric, from, to, suspect) resets `page` to the first page.

## Screens and components

Both in `readings/-components/`.

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `ReadingsPage` (`readings-page.tsx`) | "Back to asset" link; `PageHeader` "Readings" with breadcrumbs Estates / estate name / Assets / asset name / Readings (from `useEstate`, `useAsset`) and description "Sensor readings for this asset, newest first. Suspect readings are flagged."; the filters; "Loading readings…" (`role="status"`) while pending; errors as a destructive alert. Table `aria-label="Readings"`, columns Measured (`toLocaleString`), Metric (catalogue name), Value (`{value} {unit}`), Device (`deviceIdentifier`), Flags (one outline badge per flag). Pagination `nav` "Pagination": "Page {n} of {pages} · {total} reading(s)", "Previous page" (disabled on the first page) and "Next page" (disabled on the last). | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Badge`, `Button`, `Alert`, `AlertDescription`, `Empty`, `EmptyHeader`, `EmptyTitle` |
| `ReadingFilterControls` (`reading-filters.tsx`) | "Metric" select ("All metrics" plus each catalogue name), "From" and "To" `datetime-local` inputs, and a "Suspect only" checkbox. | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Field`, `FieldLabel`, `Input`, `Checkbox`, `Label` |

### Badges (`flagLabel`)

| Flag | Text |
| --- | --- |
| GAP | `Gap {formatGap(gapSeconds)}`, e.g. "Gap 2h 5m" (units d/h/m/s, zero parts left out, "0s" for zero) |
| DUPLICATE_TIMESTAMP | `Duplicate timestamp` |
| OUT_OF_RANGE | `Out of range (valid {validMin} to {validMax} {unit})`, numbers via `toLocaleString`; the range comes from the API, never hard-coded |

### Empty states

Shown (as an `Empty`, `role="status"`) when the response has `totalItems` 0.
First match wins:

1. `suspect` on: "No suspect readings match"
2. `metric`, `from` or `to` set: "No readings match these filters"
3. Otherwise: "No readings yet"

## Data (`lib/readings.ts`)

Types: `AssetReadingPage`, `AssetReading` (= `AssetReadingResponse`),
`ReadingFlag` (= `ReadingFlagResponse`), `ReadingFilters` (`metric`, `from`,
`to`, `suspect`, `page`). `READINGS_PAGE_SIZE = 50`.

Query key: `readingsQueryKey(userId, estateId, assetId, filters)` =
`["estates", userId, "assets", estateId, assetId, "readings", filters]` -
`assetQueryKey` plus `"readings"`, like the other per-asset queries.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useReadings(estateId, assetId, filters)` | `GET /estates/{estateId}/assets/{assetId}/readings` | query |

Query params sent: `metric`; `from`/`to` converted from `datetime-local` to ISO
UTC (`new Date(local).toISOString()`); `flag` = `GAP`, `DUPLICATE_TIMESTAMP`,
`OUT_OF_RANGE` when `suspect` is on; `page` (default 0); `size` 50. Undefined
params are left out. `enabled: ready`, `retry: false`,
`placeholderData: keepPreviousData` (the previous page stays visible while the
next loads); errors via `estateError`.

No mutations, so nothing is invalidated.
