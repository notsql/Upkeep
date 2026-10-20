# Suspect readings

**Status:** built
**Owner:** Zheng Kai
**Jira:** [ID-67](https://notjira.atlassian.net/browse/ID-67) (epic [ID-5](https://notjira.atlassian.net/browse/ID-5) Telemetry Ingestion); also lays the minimum of [ID-60](https://notjira.atlassian.net/browse/ID-60) Browse raw sensor readings

## Problem

A manager looking at an asset's readings cannot tell good data from bad. A
sensor that went quiet for six hours, two values recorded for the same
instant, or a pump "temperature" of 900 °C all look like ordinary rows. Acting
on them means booking callouts for faults that are really data faults, or
missing real ones hidden in a gap.

Devices now store readings in `DeviceReading` (ID-43, `.docs/api/device-readings.md`),
but nobody can see them: there is no reading browser. So this story builds the
minimum of one - an asset's reading list - and the flags on top. Everything
else ID-60 asks for, and every other way of writing readings, stays with its
own story.

## Behaviour

### Reading list (minimum of ID-60)

- An estate owner can list an asset's readings, newest first.
- The list can be filtered by metric and by a time range (`from` inclusive,
  `to` exclusive), and the filters combine.
- The list is paginated: `page` starts at 0, `size` defaults to 50 and is at
  most 200. The response gives the total number of matching readings.
- Each reading shows its measured time, metric, value with the metric's unit,
  and the identifier of the device that sent it.
- An asset with no readings shows a "no readings yet" state; filters that
  match nothing show a different "no readings match these filters" state.
- An unknown asset, or an estate the caller does not own, returns 404. A
  deactivated asset's readings can still be listed.

### Flags

Flags are computed when readings are listed, from the readings stored at that
moment. Nothing is written when a flag is raised or cleared.

**Gaps**

- A reading is flagged `GAP` when the previous reading for the same asset and
  metric is more than **1.5 ×** its device's `reportingIntervalSeconds`
  earlier, comparing `measuredAt`.
- A reading exactly 1.5 × the interval after the previous one is not flagged.
- The flag is on the reading that *ends* the gap, and carries the gap's length
  in seconds.
- The earliest stored reading for an asset and metric is never flagged `GAP`.
- The interval used is that of the device that sent the reading, measured
  against the previous reading from any device on that asset and metric.
- When a late reading is stored inside a gap (devices resend buffered
  readings out of order, decision 0028), the reading that ended the gap is no
  longer flagged the next time the list loads.

**Duplicate timestamps**

- A device can never store two readings of one metric at one instant: the
  unique index on `(deviceId, metric, measuredAt)` makes a retry idempotent and
  a different value a 409 (decision 0028). So a duplicate here is always
  **two different devices** on the same asset reporting the same metric at the
  same `measuredAt` - for example a replacement sensor registered before the
  old one was removed.
- Every reading that shares its asset, metric and `measuredAt` with at least
  one other reading is flagged `DUPLICATE_TIMESTAMP` - all of them, not all but
  the first.
- Timestamps are compared at stored precision (microseconds). Readings one
  millisecond apart are not duplicates.
- Duplicates are flagged whether the values are equal or different.

**Out of range**

- Each metric has a fixed valid range, inclusive at both ends:

  | Metric | Unit | Min | Max |
  | --- | --- | --- | --- |
  | TEMPERATURE | °C | −40 | 150 |
  | HUMIDITY | % | 0 | 100 |
  | PRESSURE | bar | 0 | 25 |
  | FLOW_RATE | L/min | 0 | 10,000 |
  | VIBRATION | mm/s | 0 | 100 |
  | VIBRATION_ACCELERATION | g | 0 | 16 |
  | POWER | kW | 0 | 1,000 |
  | ENERGY | kWh | 0 | 10,000,000 |

- A reading below the minimum or above the maximum is flagged
  `OUT_OF_RANGE`. A value equal to either bound is not.
- Out-of-range readings are stored and listed, not rejected. ID-43 already
  accepts them (decision 0028: an extreme reading may be the fault), and later
  write paths (ID-62, ID-63) must do the same.
- Values are compared as stored (`numeric(18,6)`), so a bound is exact: a
  temperature of `150.000000` is in range, `150.000001` is not.

**In the list**

- Every reading carries a `flags` array, empty when nothing is suspect. A
  reading can carry more than one flag.
- The list can be filtered to readings carrying any of one or more flags.
  Without a flag filter every reading is listed, flagged or not.
- The flag filter combines with the metric and time-range filters, and the
  total counts only matching readings.
- A `GAP` flag does not depend on the time-range filter: the first reading in
  the window is still flagged if the stored reading before it is too far back.
- Each flagged row shows a badge per flag, with the gap length for `GAP` and
  the valid range for `OUT_OF_RANGE`.
- A "Suspect only" control filters to all three flags at once.
- With a flag filter set and nothing matching, the screen says no suspect
  readings match, distinct from the two empty states above.

## Data

Readings are ID-43's `DeviceReading` table; this story adds no table and
writes nothing.

| Field | Type | Used for |
| --- | --- | --- |
| `id` | uuid | |
| `deviceId` | uuid | Device identifier and reporting interval. Never null. |
| `estateId`, `assetId` | uuid | The asset the device was on when the reading arrived. |
| `metric` | varchar(30) | Catalogue name. |
| `value` | numeric(18,6) | Out-of-range check. |
| `measuredAt` | timestamptz(6) | Ordering, time filter, gaps, duplicates. |
| `receivedAt` | timestamptz(6) | Not shown. |

One migration: add `@@index([assetId, metric, measuredAt])` to
`DeviceReading`. The existing unique index leads with `deviceId`, so it cannot
serve the list or the flag window queries, which go by asset.

Valid ranges live on the `DeviceMetric` enum next to each unit, not in a
table: the catalogue is already fixed in code (decision 0016).

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/assets/{assetId}/readings | query: `metric?`, `from?`, `to?`, `flag?` (repeatable), `page?` (default 0), `size?` (default 50, max 200) | 200 AssetReadingPage | Owner |

- `AssetReadingPage { items: AssetReadingResponse[], page: int32, size: int32, totalItems: int64 }`
- `AssetReadingResponse { id: uuid, measuredAt: date-time, metric: DeviceMetric, unit: string, value: number, deviceId: uuid, deviceIdentifier: string, flags: ReadingFlagResponse[] }`
  - Named `AssetReading*` because ID-43's `ReadingResponse` (the device-API
    reply) already exists in `com.proj.server.reading`. `value` is a decimal,
    as in that response.
- `ReadingFlagResponse { type: "GAP" | "DUPLICATE_TIMESTAMP" | "OUT_OF_RANGE", gapSeconds?: int64, validMin?: double, validMax?: double }`
  - `gapSeconds` only on `GAP`; `validMin`/`validMax` only on `OUT_OF_RANGE`,
    so the UI never hard-codes a range.

Status codes: 400 for an unknown `metric` or `flag`, `from` not before `to`,
or `size` out of bounds; 401 unauthenticated; 403 for a resident of the
estate; 404 for a foreign or missing
estate or asset.

## Frontend

- Route: `apps/web/src/routes/_auth/estates/$estateId/assets/$assetId/readings/index.tsx`,
  with its components in `readings/-components/`. Linked from the asset page.
- Hooks in `apps/web/src/lib/readings.ts`; query key is the asset's key
  (`assetQueryKey`, which carries the user's ID) plus `["readings", filters]`.
- shadcn `Table`, `Select` (metric), date-time inputs, `Badge` per flag,
  a "Suspect only" toggle and pagination controls. Filters live in the URL
  search params so a filtered view can be shared.

## Edge cases

- **Device moved.** A reading keeps the `assetId` it arrived with, so it
  stays in the old asset's list after its device moves (ID-43).
- **Clock jitter.** The 1.5 × margin means a 60 s sensor reporting at 61 s is
  not flagged; one reporting at 91 s is.
- **Device interval changed.** The current interval is used for all past
  readings. Acceptable until device editing (ID-45) says otherwise.
- **Retention (ID-66).** Once old rows are trimmed, the earliest remaining
  reading has no predecessor and is not flagged - a trim never manufactures a
  gap.
- **Device silent now.** A sensor that stopped reporting has no reading ending
  the gap, so nothing is flagged. Current silence is ID-44's offline status.
- **Page counts.** The total must come from the same flag computation as the
  rows, so the count and the pages agree when a window starts mid-gap.
- **Duplicates across pages.** Two duplicate readings can land on different
  pages; both are flagged because flags come from all stored readings, not
  the page.
- **Same device, same instant.** Impossible by decision 0028, so a single
  device never produces `DUPLICATE_TIMESTAMP`.

## Out of scope

- **Writing readings.** Live ingest is ID-43 (built); CSV import (ID-62) and
  manual entry (ID-63) are their own stories. Manual readings need a nullable
  `deviceId` or their own table, and ID-63 decides how they are flagged.
- The rest of ID-60: filtering across assets, and the performance target on a
  month of data. If query-time flags miss it, the fallback is a stored flag
  column recomputed on insert, recorded as a decision.
- Flatlined sensors (ID-68).
- Per-asset or per-estate ranges, or editing ranges in the UI.
- Excluding flagged readings from the anomaly check, failure risk or hourly
  aggregates (ID-65). Flags inform; they do not filter other features.
- Reviewing, dismissing or deleting flagged readings; alerts.
- Flags in the CSV export (ID-61).
- Estate users (non-owners) viewing readings.

## Implementation phases

Build in order, test-first.

- [x] DB: `(assetId, metric, measuredAt)` index on `DeviceReading`,
      `pnpm db:migrate`, `pnpm db:generate`.
- [x] Server: `validMin`/`validMax` on `DeviceMetric` (unit test per bound).
- [x] Server: `GET .../readings` - ownership, filters, pagination
      (Testcontainers tests per Behaviour line).
- [x] Server: flags - `OUT_OF_RANGE`, then `DUPLICATE_TIMESTAMP`, then `GAP`,
      and the `flag` filter; `pnpm api:generate`.
- [x] Web: `lib/readings.ts` and the readings route: table, filters,
      badges, empty states, pagination; link from the asset page.
- [x] Docs: `.docs/api/readings.md`, `.docs/frontend/readings.md`,
      `.docs/README.md`, the `.spec/README.md` status row.
