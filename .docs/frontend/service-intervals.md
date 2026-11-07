# Service intervals screens (ID-81)

API: [service-intervals.md](../api/service-intervals.md).

## Where

- **Asset categories page** (`/estates/$estateId/asset-categories`, see
  [asset-categories.md](asset-categories.md)): a Service interval column, an edit dialog per
  category, a missing-interval summary and filter.
- **Asset details page** (`/estates/$estateId/assets/$assetId`, see [assets.md](assets.md)): the
  `AssetServiceIntervalCard`, shown only when `estate.owned || estate.canManageInvitationPermissions`.

## Data (`src/lib/service-intervals.ts`)

| Hook / helper | Call | Query key / effect |
| --- | --- | --- |
| `useSetCategoryServiceInterval(estateId)` | PUT `/estates/{estateId}/asset-categories/{category}/service-interval` with `{ interval }`; takes `{ category, interval }` | on success invalidates `estateAssetCategoriesQueryKey(userId, estateId)` |
| `useAssetServiceInterval(estateId, assetId)` | GET `/estates/{estateId}/assets/{assetId}/service-interval` | `assetServiceIntervalQueryKey(userId, estateId, assetId)` = `["estates", userId, "assets", estateId, assetId, "service-interval"]`; `retry: false` |
| `useSetAssetServiceInterval(estateId, assetId)` | PUT `/estates/{estateId}/assets/{assetId}/service-interval` with `{ interval }`; takes `ServiceInterval \| null` | on success invalidates the asset key |
| `formatInterval(interval)` | - | "Every 1 day", "Every 14 days", "Every 6 months", "Every 1 year" (singular when the value is 1), or "Not set" for null/undefined |
| `INTERVAL_UNITS` | - | per unit (`DAY`, `MONTH`, `YEAR`): select label (Days, Months, Years), singular and plural words, and the largest value (3650, 120, 10) |

Types `ServiceInterval` (`{ value, unit }`) and `IntervalUnit` come from the generated contract. All
hooks throw `estateError(...)` on failure.

## `ServiceIntervalDialog` (`src/components/service-intervals/service-interval-dialog.tsx`)

Shared by both screens. Always-open `Dialog` with a `title`, a `description`, an "Every" number
`Input` (role spinbutton) and a "Unit" `Select` (Days, Months, Years), starting from `interval`, or
empty and Months when it is null. Save accepts only a whole number from 1 to the unit's limit;
anything else (blank included) shows the `FieldError` "Enter a whole number of <days|months|years>
from 1 to <3650|120|10>.", sets `aria-invalid` and calls nothing. **Clear** (shown only when
`interval` is not null) saves `null`. While saving, inputs and buttons are disabled; a rejected
`onSave` keeps the dialog open and shows the error in a destructive `Alert`. Cancel calls
`onCancel`.

shadcn: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`,
`DialogFooter`, `Field`, `FieldLabel`, `FieldError`, `Input`, `Select`, `SelectTrigger`,
`SelectValue`, `SelectContent`, `SelectItem`, `Button`, `Alert`, `AlertDescription`.

## `IntervalBadge` (`src/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page/interval-badge.tsx`)

An outline `Badge` with `formatInterval(interval)` as its text, coloured by unit: `DAY` blue,
`MONTH` emerald (green), `YEAR` violet (purple), each with dark-mode shades. A null interval is a
plain outline "Not set" in the muted text colour. The text always names the unit, so colour is
never the only signal.

## Asset categories page additions

- `CategorySummaryCards` (`asset-categories/-components/asset-categories-layout/category-summary-cards.tsx`): three shared
  `SummaryCard`s (`src/components/page/summary-card.tsx`, a `Card`)
  in a `sm:grid-cols-3` grid, each a `region` named by its `h2` title, with a large count and a
  lucide icon:
  - **Fails silently** (`EyeOff`): flagged count, "Categories flagged for spot checks".
  - **Missing service interval**: count of categories with no interval. Above 0: amber warning
    style and `TriangleAlert`, "N of M categories need an interval" and an outline **Show these
    categories** `Button` that selects the Not set filter. At 0: `CircleCheck`, "Every category
    has an interval.", no button.
  - **Intervals set** (`CalendarClock`): count with an interval and a per-unit breakdown for units
    in use ("1 in months · 1 in years"), or "None yet".
- shadcn `Tabs` (tablist "Filter by service interval"): All, Days, Months, Years, Not set.
  Exactly one tab is `aria-selected="true"`; All is the default. Days/Months/Years keep categories whose `serviceInterval.unit` matches; Not
  set keeps those with no interval. Local state only, not remembered. When nothing matches, the
  table is replaced by `EmptyState` "No matching categories" with an outline "Clear filters"
  that returns to All.
- Table columns: Category, Assets, Fails silently, **Service interval** (`IntervalBadge`), Last
  changed (the more recent of `lastChange` and `lastIntervalChange`; "Default" when neither), and an
  unlabelled actions column with an outline **Edit interval** `Button` (accessible name "Edit
  service interval for <Label>"), disabled in an inactive estate or while a flag save is pending.
- The button opens `ServiceIntervalDialog` titled "Service interval for <Label>"; a successful save
  or clear closes it and toasts "Service interval updated."

## `AssetServiceIntervalCard` (`assets/$assetId/-components/asset-maintenance/asset-service-interval-card.tsx`)

A `section` labelled by its "Service interval" heading, in a `Card`:

- the effective interval as the headline (`formatInterval(effective)` in large semibold text, a
  `<p>`), next to a source `Badge`: amber outline **Override** (`ASSET`), `secondary` **From
  category** (`CATEGORY`) or muted outline **No interval** (`NONE`);
- an explanation in muted text: "Replaces the <categoryLabel> interval (every N <unit>)." or "The
  <categoryLabel> category has no interval." (`ASSET`), "Inherited from the <categoryLabel>
  category." (`CATEGORY`), "Neither this asset nor the <categoryLabel> category has an interval."
  (`NONE`);
- with a lucide `History` icon, in small muted text, "Override last changed by <name or Unknown
  user> · <local date-time>" when `lastOverrideChange` is set;
- **Override** (or **Edit override** when an override exists) opens `ServiceIntervalDialog` titled
  "Override service interval"; success closes it and toasts "Service interval updated.";
- **Remove override** (only when an override exists) saves `null` directly, toasting "Override
  removed." or showing the error in a destructive `Alert`;
- prop `locked` (a reason string) disables both buttons and shows the reason as `role="note"`. The
  details page passes "This estate is inactive, so its service intervals cannot be changed." or
  "This asset is retired, so its service interval cannot be changed."

Loading shows "Loading service interval…"; a load error shows a destructive `Alert`.

shadcn: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Badge`, `Button`,
`Alert`, `AlertDescription`.
