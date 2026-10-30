# Asset categories screen (ID-83)

API: [asset-categories.md](../api/asset-categories.md).

## Route

`/estates/$estateId/asset-categories` — `src/routes/_auth/estates/$estateId/asset-categories/index.tsx`
(title "Asset categories") renders `-components/asset-categories-page.tsx`.

Entry: the estate details page shows an outline **Asset categories** link next to **Devices**, under
the same condition (`estate.owned || estate.canManageInvitationPermissions`).

## Data (`src/lib/asset-categories.ts`)

| Hook | Call | Query key / effect |
| --- | --- | --- |
| `useEstateAssetCategories(estateId)` | GET `/estates/{estateId}/asset-categories` | `estateAssetCategoriesQueryKey(userId, estateId)` = `["estates", userId, "asset-categories", estateId]`; `retry: false` |
| `useSetSilentFailure(estateId)` | PUT `/estates/{estateId}/asset-categories/{category}/silent-failure` with `{ failsSilently }`; takes `{ category, failsSilently }` | on success invalidates the list key |

Both throw `estateError(...)` on failure.

## Screen

`AssetCategoriesPage`: `PageHeader` (breadcrumbs Estates › Estate › Asset categories), then a
`section` labelled "Asset categories" with:

- summary "N categories flagged as failing silently" ("1 category" when one);
- when `estateActive` is false, a `role="note"` paragraph "This estate is inactive, so its asset
  categories cannot be changed." and every checkbox disabled;
- a `Table`: Category (row header), Assets (`activeAssetCount`), Fails silently (`Checkbox`
  labelled "<Label> fails silently"), Last changed ("Default" when `lastChange` is null, else
  "<name or Unknown user> · <local date-time>"). Rows keep the server order (flagged first).

Ticking/unticking calls the mutation (checkboxes disabled while it is pending). The checkbox is
not optimistic: it shows the server value, so a failed save leaves it unchanged and shows the
error in a destructive `Alert` (`role="alert"`); success shows the toast "Asset category updated."
Loading shows "Loading asset categories…"; a load error shows a destructive `Alert`.

shadcn components: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`,
`Checkbox`, `Alert`, `AlertDescription`; `PageHeader` from `src/components`.
