# Suspect readings

**Status:** agreed
**Owner:** Zheng Kai
**Jira:** [ID-67](https://notjira.atlassian.net/browse/ID-67) (epic [ID-5](https://notjira.atlassian.net/browse/ID-5) Telemetry Ingestion); also lays the minimum of [ID-60](https://notjira.atlassian.net/browse/ID-60) Browse raw sensor readings

## Problem

A manager looking at an asset's readings cannot tell good data from bad. A
sensor that went quiet for six hours, two values recorded for the same
instant, or a pump "temperature" of 900 °C all look like ordinary rows. Acting
on them means booking callouts for faults that are really data faults, or
missing real ones hidden in a gap.

Today nothing stores readings at all: the anomaly check scores a batch and
discards it (`.docs/api/anomaly-check.md`), and there is no reading browser.
So this story also builds the minimum both need - a `Reading` table and an
asset's reading list - and the flags on top. Everything else ID-60 asks for
(and every way of writing readings) stays with its own story.

## Behaviour

### Reading list (minimum of ID-60)

- An estate owner can list an asset's readings, newest first.
- The list can be filtered by metric and by a time range (`from` inclusive,
  `to` exclusive), and the filters combine.
- The list is paginated: `page` starts at 0, `size` defaults to 50 and is at
  most 200. The response gives the total number of matching readings.
- Each reading shows its timestamp, metric, value with the metric's unit, and
  the identifier of the device that sent it, or "Manual" when there is none.
- An asset with no readings shows a "no readings yet" state; filters that
  match nothing show a different "no readings match these filters" state.
- An unknown asset, or an estate the caller does not own, returns 404. A
  deactivated asset's readings can still be listed.

### Flags

Flags are computed when readings are listed, from the readings stored at that
moment. Nothing is written when a flag is raised or cleared.

**Gaps**

- A sensor reading is flagged `GAP` when the previous sensor reading for the
  same asset and metric is more than **1.5 ×** its device's
  `reportingIntervalSeconds` earlier.
- A reading exactly 1.5 × the interval after the previous one is not flagged.
- The flag is on the reading that *ends* the gap, and carries the gap's length
  in seconds.
- The earliest stored reading for an asset and metric is never flagged `GAP`.
- The interval used is that of the device that sent the reading, measured
  against the previous sensor reading from any device on that asset and
  metric.
- Manual readings (no device) are never flagged `GAP`, and are skipped when
  looking for a sensor reading's predecessor.
- When a late reading is stored inside a gap, the reading that ended the gap
  is no longer flagged the next time the list loads.

**Duplicate timestamps**

- Every reading that shares its asset, metric and timestamp with at least one
  other reading is flagged `DUPLICATE_TIMESTAMP` - all of them, not all but
  the first.
- Timestamps are compared at stored precision (microseconds). Readings one
  millisecond apart are not duplicates.
- Duplicates are flagged whether the values are equal or different, and
  whichever devices (or none) recorded them.

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
- Out-of-range readings are stored and listed, not rejected. Future write
  paths (ID-43, ID-62, ID-63) reject only malformed or non-finite values.

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

New Prisma model `Reading`, append-only (no `updatedAt`, never updated or
deleted by this story):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `estateId` | uuid | |
| `assetId` | uuid | Composite FK `(assetId, estateId)` → `Asset`, like `Device`. |
| `deviceId` | uuid, nullable | FK → `Device`. Null means a manual reading. |
| `metric` | varchar(30) | Catalogue name, as in `Device.metrics`. |
| `recordedAt` | timestamptz(6) | When the value was measured. |
| `value` | double precision | |
| `createdAt` | timestamptz(6) | When the row was stored. |

Indexes: `(assetId, metric, recordedAt)` for the list and the flag window
queries; `(estateId)`.

**No unique constraint on `(assetId, metric, recordedAt)`** - otherwise
duplicates can never be stored and flagged. ID-62 must stop re-imports
duplicating rows some other way (for example by import batch).

Valid ranges live on the `DeviceMetric` enum next to each unit, not in a
table: the catalogue is already fixed in code (decision 0016).

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/assets/{assetId}/readings | query: `metric?`, `from?`, `to?`, `flag?` (repeatable), `page?` (default 0), `size?` (default 50, max 200) | 200 ReadingPage | Owner |

- `ReadingPage { items: ReadingResponse[], page: int32, size: int32, totalItems: int64 }`
- `ReadingResponse { id: uuid, recordedAt: date-time, metric: string, unit: string, value: double, deviceId?: uuid, deviceIdentifier?: string, flags: ReadingFlagResponse[] }`
- `ReadingFlagResponse { type: "GAP" | "DUPLICATE_TIMESTAMP" | "OUT_OF_RANGE", gapSeconds?: int64, validMin?: double, validMax?: double }`
  - `gapSeconds` only on `GAP`; `validMin`/`validMax` only on `OUT_OF_RANGE`,
    so the UI never hard-codes a range.

Status codes: 400 for an unknown `metric` or `flag`, `from` not before `to`,
or `size` out of bounds; 401 unauthenticated; 404 for a foreign or missing
estate or asset.

## Frontend

- Route: `apps/web/src/routes/_auth/estates/$estateId/assets/$assetId/readings/index.tsx`,
  with its components in `readings/-components/`. Linked from the asset page.
- Hooks in `apps/web/src/lib/readings.ts`; query key starts with the user's ID,
  then `["readings", estateId, assetId, filters]`.
- shadcn `Table`, `Select` (metric), date-time inputs, `Badge` per flag,
  a "Suspect only" toggle and pagination controls. Filters live in the URL
  search params so a filtered view can be shared.

## Edge cases

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

## Out of scope

- **Writing readings** - live ingest (ID-43), CSV import (ID-62), manual entry
  (ID-63). Until one lands, rows exist only in tests or by hand in Prisma
  Studio.
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

- [ ] DB: `Reading` model, `pnpm db:migrate`, `pnpm db:generate`.
- [ ] Server: `validMin`/`validMax` on `DeviceMetric` (unit test per bound).
- [ ] Server: `GET .../readings` - ownership, filters, pagination
      (Testcontainers tests per Behaviour line).
- [ ] Server: flags - `OUT_OF_RANGE`, then `DUPLICATE_TIMESTAMP`, then `GAP`,
      and the `flag` filter; `pnpm api:generate`.
- [ ] Web: `lib/readings.ts` and the readings route: table, filters,
      badges, empty states, pagination; link from the asset page.
- [ ] Docs: `.docs/api/readings.md`, `.docs/frontend/readings.md`,
      `.docs/README.md`, the `.spec/README.md` status row.
