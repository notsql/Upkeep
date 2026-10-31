# 0041 — Manual readings retain human provenance separately from devices

## Status

Accepted for ID-63 / ID-64.

## Decision

Store human measurements in an append-only `ManualReading` table with a
same-estate asset foreign key, measurement/recording times, recorder subject
and display-name snapshot. Keep `DeviceReading` and its non-null device
relationship unchanged. Never manufacture a device for a person.

Read both tables as one series before filtering, counting and pagination.
Derive the source (`MANUAL` / `SENSOR`) from the stored table; callers cannot
choose their attribution. Device fields are nullable in read DTOs. Source
and recorder data also form the contract for ID-61's later CSV export.

Manual entries use the existing fixed catalogue and numeric/unit/time
validation. Extreme values are retained and flagged, as decision 0028 and
ID-67 already require. Owners, Managers and Crew may record against active
estates and assets. An estate/recorder/submission UUID identifies a retry:
identical normalized payload returns the original, conflicting payload 409.

Out-of-range flags apply to both sources. Duplicate timestamps describe all
rows with the same asset/metric/instant, extending ID-67's device-only case.
Sensor GAP predecessors remain device readings only: human measurements never
fill gaps in sensor reporting. Device last-seen, flatline and inference paths
continue to read only their existing device data.

Rejected:

- **Nullable device IDs in DeviceReading:** changes existing ingestion,
  monitoring and retry assumptions for a separate human workflow.
- **Fake manual devices:** misrepresents provenance and cadence.
- **Client-side union after paging:** produces incorrect order, page sizes,
  matching totals and duplicate flags.
- **User-created metrics now:** metric management needs its own agreed
  unit/range/history policy and is outside these stories.

## Consequences

The migration adds a table without changing the shape of existing device
rows. Read APIs gain source/recorder metadata and nullable device fields,
and the generated web contract must change with them. Existing sensor
behaviour and the month-sized query target require regression checks.
CSV provenance acceptance remains pending until ID-61 implements the export.


Precision correction agreed 2026-10-31: manual value additionally accepts an
exact decimal string, parsed directly as BigDecimal with the existing storage
bounds and no excess meaningful fractional precision. Legacy JSON-number inputs
retain their prior rounding behaviour. Reading DTOs add optional canonical
valueText for exact browser display while retaining numeric value for existing
clients. CSV remains based on the stored BigDecimal. New UI submissions and
retry fingerprints use canonical decimal text, not binary floating point.
