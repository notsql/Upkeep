# Asset history frontend

Contract: [asset-history API](../api/asset-history.md). Route paths below are under
`apps/web/src/routes/_auth/estates/$estateId/assets/`.

| Route/folder | Behavior |
| --- | --- |
| `index.tsx`, `-components/history-asset-list.tsx` | Council directory at `/estates/$estateId/assets`; owners keep the register and inspection-only readers keep their existing list. Desktop: table "Assets" (Reference, Name link, Category, Location, Status). Below 768px (`useMobile`): `ul aria-label="Assets"` of shadcn `Item size="sm"` rows divided by `ItemSeparator`, each item one link to the asset (labelled "<name> (<reference>)"): title name, muted line Reference · Category · Location, trailing secondary status `Badge` (Active / Out of use) |
| `$assetId/_details/route.tsx` | Council profile root redirects with replacement to History; the History branch renders its outlet without starting a history query |
| `$assetId/_details/history/index.tsx` | `/estates/$estateId/assets/$assetId/history`, title Asset history; validates date search before mounting the Council frame, filters and timeline |
| `$assetId/_details/history/-components/` | Timeline, entry/details components, document dialog, read-only frame and `history-date-filter.tsx` |

Assets navigation and the `_auth` parent guard recognize `canViewAssetHistory`
separately from `canViewAssets`. Council profile/history reads do not grant editing,
retirement, document association, inspection recording or private source screens.
History is an additional owner section; existing workflows remain.

## Directory and timeline

The Council list uses shadcn Input, Select, Table, Badge, Button (search/status row and table sit
straight on the page, no cards) and shared
loading/error/empty components. It calls GET `/estates/{estateId}/asset-history`.
URL search holds `q`, `status`, `cursor`. Search debounces 300 ms; search/status
changes reset paging. Next page retains filters, First page clears the cursor,
and browser Back restores URL state. Empty estate, no matches and failures differ.
All/Active/Retired choices default to All; retired/inactive reads remain available.

The frame uses `PageLayout`, `DetailPageHeader`, Badge and History-only SubNav,
showing reference, name, category, location and lifecycle status. Installation is
summary information. No owner-only asset query supplies the Council frame.
The History leaf route owns this frame so it shares the applied date bounds with
the timeline and never starts a separate unfiltered query for a filtered URL.

The timeline uses shadcn Badge/Button and a divided ordered list named Recorded asset
history (rows, not cards); the date filter is a plain form, not a card. Every row has a type label, heading and time element. Dates retain date-only
precision; instants display SGT. Documents explicitly label Upload date. Unknown
costs/provider/downtime display Not recorded; zero stays zero. Completion corrections
show Edited. Conditions show stored condition/notes and provenance, including
Anomaly detection. Source detail links require both their server flag and current
independent capability. No inference, prediction comparison or polling runs.

Load more uses the combined server cursor. A later-page error retains loaded entries
and retries that page. Initial loading, no recorded history, denied access and read
failure differ. Hidden document authority is explained separately. History states
that older activity may not have been recorded.

## Date range

The date form sits in a `FilterBar` (label "Filter history") behind a
`FilterToggle` at the top right of the tab, opened with `useFilterPanel`: shut
by default, open on desktop when the URL already has a range, and a bottom
sheet titled "Filters" on mobile (see design-system.md). The toggle reads
"Filters, 1 active" while either bound is applied. The Singapore-days hint
lives inside the panel.

History URL search holds optional `from`/`to` in strict `YYYY-MM-DD` form. The
shadcn-based shared DatePicker fields are labelled From date and To date; Apply
dates submits the draft and Clear dates removes both bounds. Both days are
inclusive in Singapore time; either bound can be omitted. Invalid/reversed drafts
show an accessible error without changing applied results. Invalid URLs show a
route error before a history read. Reload and Back/Forward restore applied fields.

Filtering runs on the server before pagination; Load more and Retry retain both
bounds. Empty filtered results say No recorded history in this date range while
keeping the asset summary and Clear dates. Unfiltered history keeps its existing
empty state. Applying a changed range starts at page one, including when that
range has cached pages, and closes any viewer. Late page/file responses cannot
replace the new scope. Date controls stack on mobile and share a row on wide screens.

## Document viewer

Selecting a document opens a labelled shadcn Dialog with filename/type/upload time.
Only then does the generated client fetch the authenticated content endpoint in blob
mode. PDF previews use the native browser PDF object viewer; images use an image
preview. Unsupported/failed previews retain Download and a manual fallback control.
File errors show Retry while the timeline remains loaded. Heading focus on open and
entry focus on close preserve keyboard use and scroll position. Object URLs are
revoked on replacement, close and scope change. Unmounted reads are aborted; late
results cannot replace another document's viewer.

## Hooks, cache and refresh

`apps/web/src/lib/asset-history.ts` owns generated DTO aliases, capabilities, typed
queries/errors and Singapore formatting. Keys:

- History: `[userId, "asset-history", estateId, assetId, from, to]`, with absent
  bounds normalized to empty strings in the key.
- Directory: `[userId, "asset-history", estateId, "list", q, status, cursor]`.
- Open blob: `[userId, "asset-history", estateId, assetId, "document", documentId]`.

Reads throw API errors. 401/403/404 invalidate app access and hide inaccessible data.
Account/estate/asset changes isolate cache and remount viewer state. Blob queries
have zero garbage-collection time. History refetches stale data on return/window focus.
Applied date changes also remount timeline/viewer state. The Apply/Clear action
resets the destination range's cached pages before navigation; browser history
restores each range through its own query key. The estate refresh prefix still
resets all date variants after source writes.
Revoking document access immediately hides cached document entries, closes the
viewer and revokes its object URL while leaving other recorded activity readable.

`refreshAssetHistory` resets the user's estate history prefix after maintenance,
condition, inspection, asset creation/edit/lifecycle, work-order creation/progress/
completion/correction, document upload/deletion and either association mutation.
This refreshes former/new assets and directory identity/status, discarding old pages
and restarting active history from page one. It never synthesizes repairs/costs.
Saving a linked work-order completion closes the order (`CLOSED`); the server
projects its canonical completion as Work order completed. Existing closed orders
are included on refresh, without creating separate manual maintenance records.

Tests cover source chronology/provenance, paging/retry, native previews, lazy file
reads, focus/URL cleanup, scope/permission changes, Council search/pagination,
navigation/parent guards, date validation/URL restoration, range pagination and
observable refresh after source writes.

## Phones: infinite scroll

Below `md` the paged lists here scroll instead of paging: the shared `LoadMore` sentinel (see design-system.md) appends the next page of "Asset pages" history asset list (`useHistoryAssetFeed`, key `[userId, "asset-history", estateId, "feed", q, status]`); First page / Next page are hidden there.
