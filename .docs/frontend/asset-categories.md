# Asset categories screen (ID-83)

API: [asset-categories.md](../api/asset-categories.md).

## Routes

Folder-based under `src/routes/_auth/estates/$estateId/asset-categories/`, all titled "Asset categories":

| File | URL | Renders |
| --- | --- | --- |
| `route.tsx` | layout | `AssetCategoriesLayout` around an `Outlet` |
| `index.tsx` | `/estates/$estateId/asset-categories` | `AssetCategoriesList filter="ALL"` |
| `$interval/index.tsx` | `/estates/$estateId/asset-categories/$interval` | `AssetCategoriesList` for `days` / `months` / `years` / `not-set` (`INTERVAL_SLUGS`, `intervalFilterFor`); any other segment is `notFound()` in `beforeLoad` |

The sub-views share the section's `_auth` gate (`SUB_VIEW_SECTIONS`).

Entry: sidebar Administration › **Asset categories**, shown by `canOpenAssetCategories`
(`owned || canManageInvitationPermissions`); the `_auth` guard 404s otherwise.

## Data (`src/lib/asset-categories.ts`)

| Hook | Call | Query key / effect |
| --- | --- | --- |
| `useEstateAssetCategories(estateId)` | GET `/estates/{estateId}/asset-categories` | `estateAssetCategoriesQueryKey(userId, estateId)` = `["estates", userId, "asset-categories", estateId]`; `retry: false` |
| `useSetSilentFailure(estateId)` | PUT `/estates/{estateId}/asset-categories/{category}/silent-failure` with `{ failsSilently }`; takes `{ category, failsSilently }` | on success invalidates the list key |

Both throw `estateError(...)` on failure.

## Screen

`AssetCategoriesLayout`: `ListPageHeader` (`Tags` icon, "Silent-failure flags and service intervals"; no breadcrumbs, no filters or create), then a
`section` labelled "Asset categories" with the summary cards, a `SubNav` ("Filter by service interval": All (exact), Days, Months, Years, Not set - each its own URL) and the child view. `AssetCategoriesList` (`-components/asset-categories-page/asset-categories-page.tsx`; state in `use-asset-categories-list.ts`, table in `asset-categories-table.tsx`) renders:

- summary cards (Fails silently, Missing service interval, Intervals set), described in
  [service-intervals.md](service-intervals.md);
- when `estateActive` is false, a `role="note"` paragraph "This estate is inactive, so its asset
  categories cannot be changed." and every row action disabled;
- a `Table` with no inline form controls: Category (row header), Assets (`activeAssetCount`),
  Fails silently (a `warning` "Fails silently" `Badge`, or "No"), Service interval, Last changed ("Default"
  when neither `lastChange` nor `lastIntervalChange` is set, else "<name or Unknown user> · <local
  date-time>" of the more recent one) and right-aligned actions: **Edit interval** (aria-label
  "Edit service interval for <Label>") and **Flag** / **Stop flagging** (aria-label
  "Flag <Label> as failing silently" / "Stop flagging <Label>"). Rows are sorted by label on the
  client, so a row does not jump when its flag changes (the server returns flagged first).
- the service-interval summary, unit labels, filter by interval and dialog (ID-81), described in
  [service-intervals.md](service-intervals.md).

Flag / Stop flagging opens `-components/asset-categories-page/silent-failure-dialog.tsx`, the shared `ConfirmDialog`
("Flag <Label> as failing silently?" / "Stop flagging <Label>?", description states the effect) with Cancel and a confirm button
("Flag category" (default variant), or destructive "Stop flagging"; "Saving…" while pending). Confirming calls the mutation; the dialog
locks while pending. Success closes the dialog and toasts "Asset category updated."; a failure
keeps the dialog open with the error as its `role="alert"` line. Nothing is
optimistic. Loading is `LoadingState` "Loading asset categories…" (`table`); a load error is an `ErrorState` (Retry).
The Missing service interval card's "Show these categories" is an outline sm shadcn `Button` rendering a router `Link` to `/asset-categories/not-set`. When a view matches nothing the table is
replaced by `EmptyState` "No matching categories" ("No category uses this interval") with an outline "Clear filters" link back to All.

shadcn components: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`,
`Badge`, `Button`, `buttonVariants`; from `src/components`: `ListPageHeader`, `SubNav`, `ErrorState`, `EmptyState`, `ConfirmDialog`, `ServiceIntervalDialog`.
