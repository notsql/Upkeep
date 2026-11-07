# Manufacturer service intervals (ID-81)

**Status:** built (revised 2026-11-01: day/month/year units; unit labels and filter; summary cards; asset card layout)
**Owner:** Yan Hein Latt

## Problem

A Manager can't record how often the manufacturer says equipment should be
serviced. Without that, nothing in the app can work out when a check is due
from real priors:

- ID-80 (Zheng Kai) needs an interval to fall back on when the failure model
  isn't confident.
- ID-84 needs one to put assets on the monthly inspection list when there's no
  prediction.

There's also no way to see which categories still need an interval entered, or
who changed one.

"Asset class" in the story is an **asset category**, as in ID-83. Categories
are a global catalogue, so the category interval is an **estate setting**
layered on top of it, the same way ID-83's silent-failure flag is. A single
asset can override its category's interval.

## Behaviour

### Who

- The estate owner and the estate's assigned Managers can read and change
  intervals. This is the same `findManaged` check as ID-83.
- A same-estate Resident gets 403. Any other estate, or one the user doesn't
  manage, gets 404. An asset that isn't in that estate also gets 404.
- Changing an interval in an inactive estate gets 409. Reading still works.
- Changing an asset's override on a deactivated or retired asset gets 409.
  Reading still works.

### Intervals

- An interval is a whole number with a **unit**: `DAY`, `MONTH` or `YEAR`.
  The limits are 1–3,650 days, 1–120 months or 1–10 years (at most ten years
  in any unit).
- The value and unit are stored as entered. "12 months" and "1 year" are
  different values: nothing is converted.
- Each estate has at most one current interval per category. A category starts
  with no interval. There is no default.
- Each asset has at most one current override. An asset starts with no
  override.
- An asset's **effective interval** is its override if it has one, otherwise
  its category's interval in that estate, otherwise none. The source is
  reported as `ASSET`, `CATEGORY` or `NONE`.
- Setting an interval or an override to `null` clears it. Clearing an override
  makes the asset fall back to its category's interval.
- Every change records who made it (user ID, plus a WorkOS display-name
  snapshot) and when. Changes are append-only history, and the current value
  is the latest change.
- Setting a value to the one it already has, same number and same unit
  (including clearing one that is already clear), is a no-op. It returns the
  current state and records nothing.
- Changing a category's interval doesn't change any asset's override.
- An unknown category code gets 404.

### Listing categories (extends ID-83's list)

- Each category in `GET /estates/{estateId}/asset-categories` also returns its
  `serviceInterval` (`{ value, unit }`, or null) and its latest interval change
  (who, when, the value set), or none.
- The existing order (flagged first, then by label) is unchanged.

### Screen: Asset categories page

- The table gains a **Service interval** column. A category with an interval
  shows "Every N days", "Every N months" or "Every N years" (singular when N
  is 1: "Every 1 day", "Every 1 month", "Every 1 year"). A category without
  one shows "Not set".
- The interval is shown as a **label coloured by its unit**: days blue, months
  green, years purple. "Not set" is a plain grey outline. The colour is extra
  only: the text always says the unit, so nothing depends on seeing colour.
- Each row has an **Edit interval** button (accessible name
  "Edit service interval for <label>"). It opens a dialog with an "Every"
  number input, a "Unit" select (Days, Months, Years; Months when nothing is
  set yet) and Save, Clear and Cancel buttons.
- The dialog rejects anything other than a whole number within the chosen
  unit's limit, with the message "Enter a whole number of days from 1 to
  3650." (or "months from 1 to 120.", "years from 1 to 10."). It doesn't send
  anything to the API until the value is valid.
- Saving or clearing shows a toast and refreshes the list. If it fails, the
  dialog stays open and shows the error.
- Above the filter, three **summary cards** (each a region named by its title)
  replace the plain summary lines (including ID-83's "N categories flagged as
  failing silently"):
  - **Fails silently**: the number of flagged categories, with "Categories
    flagged for spot checks".
  - **Missing service interval**: the number of categories with no interval,
    with "N of M categories need an interval" and a **Show these categories**
    button that selects the Not set filter. The card has a warning style when
    the number is above 0. At 0 it reads "Every category has an interval." with
    no button and no warning style.
  - **Intervals set**: the number of categories with an interval, with a
    breakdown by unit for the units in use, e.g. "1 in months · 1 in years", or
    "None yet" when there are none.
- A **Filter by service interval** group of toggle buttons sits above the
  table: All, Days, Months, Years and Not set. Exactly one is pressed
  (`aria-pressed`), All by default. Days, Months and Years show only the
  categories whose interval has that unit. Not set shows the categories with
  no interval, which is the list to complete. The filter is on screen only and
  is not remembered.
- When a filter matches nothing, the table is replaced by "No categories match
  this filter."
- The Last changed column shows the most recent change to either the flag or
  the interval.
- In an inactive estate the Edit interval buttons are disabled, under the
  existing inactive note.

### Screen: asset details page

- A **Service interval** card leads with the effective interval in large text
  ("Every N <unit>", or "Not set"), followed by a **source badge** and a line
  explaining it:
  - Override: an amber **Override** badge and "Replaces the <category label>
    interval (every N <unit>)." or, when the category has none, "The
    <category label> category has no interval."
  - From the category: a grey **From category** badge and "Inherited from the
    <category label> category."
  - None: an outline **No interval** badge and "Neither this asset nor the
    <category label> category has an interval."
- Below that, in small muted text, the latest override change (who and when),
  if there is one.
- Owners and Managers see **Override** (or **Edit override**) and, when an
  override exists, **Remove override**. Override uses the same interval dialog
  and validation as the category page.
- Other users don't see the card at all, since they can't call the endpoint.
- On a deactivated or retired asset, or in an inactive estate, the buttons are
  disabled with a short reason.

## Data

Expand-only. This adds two new tables, following ID-83's history pattern:

```prisma
// Append-only history of an estate's service interval per asset category (ID-81).
// The current interval is the latest row; null clears it. No rows means no interval.
model AssetCategoryIntervalChange {
  id              String   @id @default(uuid()) @db.Uuid
  estateId        String   @db.Uuid
  category        String   @db.VarChar(30)
  intervalValue   Int?
  intervalUnit    String?  @db.VarChar(5)
  changedByUserId String   @db.VarChar(255)
  changedByName   String?  @db.VarChar(255)
  changedAt       DateTime @default(now()) @db.Timestamptz(6)

  estate        Estate        @relation(fields: [estateId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  assetCategory AssetCategory @relation(fields: [category], references: [code], onDelete: Restrict, onUpdate: Restrict)

  @@index([estateId, category, changedAt])
}

// Append-only history of one asset's service-interval override (ID-81).
// The current override is the latest row; null removes it.
model AssetIntervalChange {
  id              String   @id @default(uuid()) @db.Uuid
  assetId         String   @db.Uuid
  intervalValue   Int?
  intervalUnit    String?  @db.VarChar(5)
  changedByUserId String   @db.VarChar(255)
  changedByName   String?  @db.VarChar(255)
  changedAt       DateTime @default(now()) @db.Timestamptz(6)

  asset Asset @relation(fields: [assetId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@index([assetId, changedAt])
}
```

`Estate`, `AssetCategory` and `Asset` gain the matching back-relations. The
migration adds a `CHECK` to both tables by hand, because Prisma can't express
it: either both columns are null (cleared), or the unit is `DAY`, `MONTH` or
`YEAR` and the value is within that unit's limit.

For ID-80 and ID-84 to reuse on the server side, a
`ServiceIntervalService.effective(estateId, assetId)` method returns
`{ interval: { value, unit } | null, source }`. Due dates are calendar
arithmetic on the unit (add N days, months or years).

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/asset-categories` | - | `EstateAssetCategoriesResponse` (changed: each category gains `serviceInterval: ServiceInterval \| null` and `lastIntervalChange: IntervalChangeResponse \| null`) | Owner or assigned Manager |
| PUT | `/estates/{estateId}/asset-categories/{category}/service-interval` | `SetServiceIntervalRequest { interval: ServiceInterval \| null }` | `EstateAssetCategoryResponse` | Owner or assigned Manager; active estate |
| GET | `/estates/{estateId}/assets/{assetId}/service-interval` | - | `AssetServiceIntervalResponse` | Owner or assigned Manager |
| PUT | `/estates/{estateId}/assets/{assetId}/service-interval` | `SetServiceIntervalRequest { interval: ServiceInterval \| null }` | `AssetServiceIntervalResponse` | Owner or assigned Manager; active estate; active, unretired asset |

The types:

- `ServiceInterval` has `value` (integer) and `unit` (`"DAY" | "MONTH" | "YEAR"`).
- `IntervalChangeResponse` has `interval` (`ServiceInterval` or null),
  `changedByUserId`, `changedByName` (optional) and `changedAt`.
- `AssetServiceIntervalResponse` has these fields:
  - `effective`: `ServiceInterval` or null
  - `source`: `"ASSET" | "CATEGORY" | "NONE"`
  - `override`: `ServiceInterval` or null
  - `categoryInterval`: `ServiceInterval` or null
  - `categoryLabel`: string
  - `lastOverrideChange`: `IntervalChangeResponse` or null

On the PUT requests, `interval` must be present. It is either `null` or a
`ServiceInterval` whose `value` and `unit` are both present:

- A missing key, a missing value or unit, an unknown unit, a value that isn't
  a JSON integer, or a value outside the unit's limit gets 400, with a message
  starting with `interval`.
- The integer check uses the same strict deserializer approach as ID-49's
  `WholeNumberDeserializer`.

All the new endpoints are added to the `SecurityConfig` allowlist.

## Edge cases

- **Two Managers change the same interval at the same moment.** Both changes
  are recorded and the latest `changedAt` (then `id`) wins, as in ID-83.
- **Clearing a category's interval while some assets override it.** Those
  assets keep their overrides. The others drop to `NONE`.
- **An override equal to the category's interval** is recorded as an override.
  It stays fixed if the category's interval changes later.
- **An asset whose category changes** (if asset editing allows that) keeps its
  override. Without one, it takes the new category's interval.
- **A category with no active assets** still appears and counts as missing an
  interval.
- **Request is `{}`, `{"interval": {"value": 6}}`, a unit of `"WEEK"`, a value
  of `"6"`, `6.5` or `0`, or 3,651 days, 121 months or 11 years.** Each gets
  400 with a message starting with `interval`.
- **An interval shorter than a month** (such as 7 days) is allowed. For ID-84
  it means the asset is due on every monthly list.
- **A Manager of estate A sends estate B's asset ID under estate A** gets 404.

## Out of scope

- **Using the interval in predictions or fallbacks.** That's ID-80. This story
  only stores intervals and exposes `effective()`.
- **Due dates and the inspection list.** That's ID-84, and overdue checks are
  ID-86.
- **Intervals per manufacturer or per model.** The story asks for per class,
  overridable per asset.
- **Other units** (weeks, running hours, cycles). Weeks can be entered as days.
- **A screen showing an interval's full change history.** The history is
  stored, but only the latest change is shown.
- **Bulk editing.** Intervals are set one category, or one asset, at a time.
- **Custom estate-role permissions.** Only owners and Managers, as in ID-83.

## Decisions

Agreed on 2026-11-01, taking the defaults the draft proposed:

1. **Unit:** a value with a day, month or year unit, stored as entered, up to
   ten years. (First agreed as whole months only; revised the same day at the
   owner's request so the manufacturer's figure is kept exactly.)
2. **ID-80's "manufacturer or estate default":** read as `ASSET` (the override
   on the asset) versus `CATEGORY` (the estate's figure for the category).
   Zheng Kai should still confirm this matches what ID-80 needs.
3. **Who reads it:** owners and assigned Managers only, like ID-83.
4. **Retired assets:** their overrides are read-only, like deactivated ones.
