# Maintenance costs (ID-50)

**Status:** built
**Owner:** Yan Hein Latt

## Problem

An estate owner can't see what an asset has cost to maintain. Completed work
orders carry labour and parts costs, but manual maintenance entries
([maintenance-history.md](maintenance-history.md), ID-49) carry none. Nothing
adds the costs up over a period, so expensive equipment can't be spotted, and
there are no figures to bring to a repair-or-replace discussion.

## Behaviour

### Costs on manual entries

- A manual maintenance entry (`AssetEvent`) may record three costs, all
  optional: `labourCost`, `partsCost` and `otherCost`.
- They follow the work-order completion rules exactly:
  - the request sends decimal strings of 1–12 whole digits and at most two
    decimals, not negative;
  - the response returns two-decimal strings or null;
  - all costs are SGD.
- An omitted cost means "unknown" and is stored as null. An explicit `0` is
  stored as zero.
- A negative cost, scientific notation, more than two decimals or too many
  digits is rejected with 400, and nothing is written.
- The response also carries `totalCost`, the sum of the three. It is null
  when any of the three is unknown, matching the work-order rule.
- Costs don't affect failure-risk forecasts. Entries stay append-only.
- The record dialog gains Labour cost, Parts cost and Other cost (SGD)
  inputs in its "Maintenance details" group.

### Cost view on the asset

- The asset details page gains a **Maintenance costs** section. It lists
  every manual entry and every completed work order for the asset, with
  date, entry, labour, parts, other and total.
- A work order's row uses its completion's labour, parts and total. Its
  "other" column shows "Not applicable", because work orders don't record
  other costs.
- Each completed work order appears exactly once. Its cost comes only from
  its `WorkOrderCompletion`. Closing a work order never creates a manual
  entry, so nothing is counted twice.
- **From** and **To** date inputs limit the rows, inclusive of both dates.
  Empty means unbounded, and both start empty, so the default view is all
  time.
  - A manual entry's date is `occurredOn`.
  - A work order's date is its `completedAt` in the viewer's local time.
- A "From" date later than "To" shows an error and no rows.
- An unknown cost shows "Unknown". An explicit zero shows "0.00".
- A totals row sums each column over the rows in range, counting only
  known values. Its overall figure is labour + parts + other, so a row's
  known costs count even when that row's own total is unknown.
  - When any cost in range is unknown, the totals row is labelled "Known
    costs" and a note says how many entries have unknown costs.
  - When every cost is known, it is labelled "Total".
- Sums are exact. Amounts are added as whole cents, never as floating-point
  numbers.
- When there are no entries in range, the section shows "No maintenance
  costs in this period."
- Rows are ordered newest first, the same as the Maintenance section.
- A work order's reference links to the work order when the viewer can see
  work orders, as in the Maintenance section.

## Data

Expand-only. Each new column is nullable:

```prisma
model AssetEvent {
  // ...existing fields
  labourCost Decimal? @db.Decimal(14, 2)
  partsCost  Decimal? @db.Decimal(14, 2)
  otherCost  Decimal? @db.Decimal(14, 2)
}
```

## API

There are no new endpoints. The cost view reads the two existing lists,
which the asset page already loads, and adds them up in the browser.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/assets/{assetId}/events` | `CreateAssetEventRequest` + `labourCost?`, `partsCost?`, `otherCost?` (decimal strings) | `AssetEventResponse` + `labourCost`, `partsCost`, `otherCost`, `totalCost` (two-decimal string or null) | Estate owner |
| GET | `/estates/{estateId}/assets/{assetId}/events` | - | `AssetEventResponse[]` with the same four fields | Estate owner |
| GET | `/estates/{estateId}/assets/{assetId}/work-order-completions` | - | Unchanged | Estate owner |

## Edge cases

- `"0"` and `"0.00"` both store zero, and both return `"0.00"`.
- An entry with all three costs known, one of them zero, has a known total.
  An entry with any cost unknown has an unknown total, but its known costs
  still count in the column totals.
- A work order completed late on the last day of the range is included or
  not depending on the viewer's local date. That is accepted, and the date
  shown in the row is the same local date.
- Entries recorded before ID-50 have unknown costs.
- A retired asset's costs still show. Recording stays blocked, as today.
- Large totals: 12 whole digits per amount, summed as cents, stays within
  safe integers for any realistic number of rows.

## Out of scope

- Managers who don't own the estate. Both reads are owner-only today, the
  same as ID-49.
- Estate-wide or cross-asset cost reports, charts, exports and budgets.
- Currencies other than SGD.
- Editing costs on existing manual entries, which stay append-only.
- Adding an "other" cost to work-order completions.
