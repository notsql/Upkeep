# Asset categories screen (ID-83)

API: [asset-categories.md](../api/asset-categories.md).

## Route

`/estates/$estateId/asset-categories` — `src/routes/_auth/estates/$estateId/asset-categories/index.tsx`
(title "Asset categories") renders `-components/asset-categories-page.tsx`.

Entry: sidebar Administration › **Asset categories**, shown by `canOpenAssetCategories`
(`owned || canManageInvitationPermissions`); the `_auth` guard 404s otherwise.

## Data (`src/lib/asset-categories.ts`)

| Hook | Call | Query key / effect |
| --- | --- | --- |
| `useEstateAssetCategories(estateId)` | GET `/estates/{estateId}/asset-categories` | `estateAssetCategoriesQueryKey(userId, estateId)` = `["estates", userId, "asset-categories", estateId]`; `retry: false` |
| `useSetSilentFailure(estateId)` | PUT `/estates/{estateId}/asset-categories/{category}/silent-failure` with `{ failsSilently }`; takes `{ category, failsSilently }` | on success invalidates the list key |

Both throw `estateError(...)` on failure.

## Screen

`AssetCategoriesPage`: `PageHeader` (no breadcrumbs; top-level section), then a
`section` labelled "Asset categories" with:

- summary cards (Fails silently, Missing service interval, Intervals set), described in
  [service-intervals.md](service-intervals.md);
- when `estateActive` is false, a `role="note"` paragraph "This estate is inactive, so its asset
  categories cannot be changed." and every row action disabled;
- a `Table` with no inline form controls: Category (row header), Assets (`activeAssetCount`),
  Fails silently (a "Fails silently" `Badge`, or "No"), Service interval, Last changed ("Default"
  when neither `lastChange` nor `lastIntervalChange` is set, else "<name or Unknown user> · <local
  date-time>" of the more recent one) and right-aligned actions: **Edit interval** (aria-label
  "Edit service interval for <Label>") and **Flag** / **Stop flagging** (aria-label
  "Flag <Label> as failing silently" / "Stop flagging <Label>"). Rows are sorted by label on the
  client, so a row does not jump when its flag changes (the server returns flagged first).
- the service-interval summary, unit labels, filter by interval and dialog (ID-81), described in
  [service-intervals.md](service-intervals.md).

Flag / Stop flagging opens `-components/silent-failure-dialog.tsx`, a confirmation `Dialog`
("Flag <Label> as failing silently?" / "Stop flagging <Label>?") with Cancel and a confirm button
("Flag category", or destructive "Stop flagging"). Confirming calls the mutation; buttons are
disabled while pending. Success closes the dialog and toasts "Asset category updated."; a failure
keeps the dialog open with the error in a destructive `Alert` (`role="alert"`). Nothing is
optimistic. Loading is `LoadingState` "Loading asset categories…" (`table`); a load error shows a destructive `Alert`.
The interval filter is shadcn `Tabs` (tablist "Filter by service interval": All, Days, Months,
Years, Not set; the selected tab is `aria-selected`). When a filter matches nothing the table is
replaced by `EmptyState` "No matching categories" with an outline "Clear filters" back to All.

shadcn components: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`,
`Badge`, `Button`, `Tabs`, `TabsList`, `TabsTrigger`, `Dialog` (+ Content/Header/Title/Description/Footer), `Alert`, `AlertDescription`; `PageHeader` from `src/components`.
