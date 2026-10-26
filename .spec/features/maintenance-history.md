# Maintenance history (ID-49)

**Status:** built
**Owner:** Yan Hein Latt

## Problem

An estate owner can record a repair or preventive service against an asset,
but only as a type, a date and free-text notes. Historical paperwork usually
says more: what was found, what was done, who did it, which parts were
replaced and how long the asset was out of service. Today that detail is
buried in the notes, if it is kept at all, so the asset's history cannot be
compared like for like with the outcomes of completed work orders.

Most of ID-49 is already built. The work-order PRs (#33/#36) added
`GET /estates/{estateId}/assets/{assetId}/work-order-completions`, and the
asset's Maintenance section already:

- combines manual events with completed work orders, newest first;
- shows each completion once (it reads the canonical `WorkOrderCompletion`
  rows, not copies);
- labels completions "Work order" and links to the original work order.

This spec covers what is left: the extra fields on manual entries, and
tests that pin down the behaviour already built.

## Acceptance criteria → status

| ID-49 criterion | Status |
| --- | --- |
| Manual entry with date, findings, work performed and service provider where known | **To build:** date exists; the other three are new optional fields |
| Parts replaced and downtime where applicable | **To build:** new optional fields |
| Completed asset-linked work orders in the same history | Built |
| Manual entries distinguishable from work-order entries, linked to the work order | Built (the "Work order" badge and the reference link); add a "Manual entry" badge for symmetry |
| Each work-order completion shown once | Built and tested |
| Access limited to estates the user is authorised to manage | Built: owner-only, the same as the existing event and completion reads (see Out of scope) |

## Behaviour

- A manual maintenance entry may also carry, all optional:
  - `findings`: what was found, up to 2500 characters;
  - `workPerformed`: what was done, up to 2500 characters;
  - `serviceProvider`: who did it, such as a contractor's name, up to 200
    characters;
  - `partsReplaced`: up to 2500 characters;
  - `downtimeMinutes`: a whole number, 0 or more.
- Text fields are trimmed. Blank optional text is stored as null, meaning
  "not known", the same as for work-order completions.
- `downtimeMinutes` of 0 means "no downtime"; null means "not known". The
  screen shows them differently, as it already does for work-order
  completions.
- A negative or fractional `downtimeMinutes` is rejected with 400, and so is
  text over its limit.
- `notes` stays required and unchanged, so existing clients and stored rows
  keep working.
- The new fields do not affect failure-risk forecasts, which still read only
  `type`, `occurredOn` and the catalogue IDs.
- Events stay append-only. Entries recorded before this change show only
  the fields they have.
- The Maintenance section shows each provided field on a manual entry under
  a label (Findings, Work performed, Service provider, Parts replaced,
  Downtime), and omits the ones that are null.
- A manual entry is badged "Manual entry"; a completion stays badged "Work
  order" and linked.
- The Record maintenance dialog gains the five optional inputs. Downtime is
  a number input in minutes.

## Data

Expand-only. Each new column is nullable, so the running code is
unaffected:

```prisma
model AssetEvent {
  // ...existing fields
  findings        String? @db.VarChar(2500)
  workPerformed   String? @db.VarChar(2500)
  serviceProvider String? @db.VarChar(200)
  partsReplaced   String? @db.VarChar(2500)
  downtimeMinutes Int?
}
```

The migration adds the five columns. There is no backfill.

## API

No new endpoints; existing ones gain fields.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/assets/{assetId}/events` | `CreateAssetEventRequest` + `findings?`, `workPerformed?`, `serviceProvider?`, `partsReplaced?`, `downtimeMinutes?` | `AssetEventResponse` with the same five fields, nullable | Estate owner |
| GET | `/estates/{estateId}/assets/{assetId}/events` | - | `AssetEventResponse[]` with the five fields | Estate owner |

## Edge cases

- When both `notes` and `findings` are supplied, both are stored; one does
  not replace the other.
- `downtimeMinutes` sent as `1.5` or `"abc"` gets a 400, not a silent
  truncation. This reuses `WholeNumberDeserializer`.
- Old rows return null for all five fields, and the UI renders them as
  before.
- A retired asset's history still lists completions and manual entries.
  Recording stays blocked, as today.

## Out of scope

- Giving non-owner Managers access to manual events or asset completion
  reads. Both are owner-only today, and widening that is a permissions
  change of its own.
- Costs on manual entries. They are not in ID-49's criteria.
- Editing or deleting manual entries, which stay append-only.
- Attaching documents to manual entries. Documents link to work orders only.
- Filtering or exporting the history.
