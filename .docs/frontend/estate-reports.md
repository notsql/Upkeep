# Estate fault report screens

Duplicate badges, the detail duplicate section and Mark as duplicate are
documented in [fault-report-duplicates.md](fault-report-duplicates.md).

Estate and resident report lists/details use the same presentation components
in `apps/web/src/components/reports/`: `report-card.tsx`,
`report-metadata.tsx`, `report-details.tsx` and `report-image.tsx`. Cards show
labelled Estate name, Location, Status and Submission time, with location and
status sharing an aligned row that wraps on narrow screens. Detail adds the
shared Description and Images sections. Estate detail opts into Updated and
supplies Change location only when permitted. Route-specific hooks, links,
filters and pagination remain in the estate routes. The adjacent
`-components/private-report-image.tsx` wraps the responder image query and
delegates blob presentation and URL cleanup to `ReportImage`, supplying the
existing "Loading image…" status.

Routes are folder-based under `apps/web/src/routes/_auth/estates/$estateId/reports/`.
List and detail use the shared PageHeader. The list has no breadcrumbs; detail
("Fault report details") shows `Fault reports › <report title>` ("Fault report"
while loading) and places Create work order in the header actions. No back
link.
`_auth` authenticates and checks the requested estate's `canViewFaultReports`
before any child query can mount. Crew and custom report readers can enter report routes without general
management rights. Council/Resident membership and provider-admin claims cannot
bypass this capability. Personal `/reports` history remains separate.
Existing owners receive the same report navigation and screens as new owners
after the owner-membership backfill migration is applied and access context is
refetched. No frontend ownership bypass is used; the repaired MANAGER membership
supplies the existing report capabilities.

| Route folder | Screen and components | API calls |
| --- | --- | --- |
| `reports/index.tsx` → `/estates/{estateId}/reports` (route only; the page is `-components/estate-reports-page/estate-reports-page.tsx`, composing `estate-reports-locations.tsx` and `estate-reports-results.tsx`, state in `use-estate-reports-page.ts`) | Flat `ListRows` "Reports" of `ReportRow`s (`components/reports/report-row.tsx`, design-system "List rows"; no cards) with linked `h2` title, labelled estate name, full location path, status Badge and submission time. shadcn Card, Label, Combobox, Button and Alert. URL block/level-position filters, All blocks/clear, loading/retry, empty/no-matches and cursor pagination. | GET `/estates/{estateId}/reports`; GET `/estates/{estateId}/locations?includeInactive=true`; access context |
| `reports/$reportId/index.tsx` → `/estates/{estateId}/reports/{reportId}` | Shared report Card/Badge and metadata, Updated timestamp, complete plain-text description, private images and empty/image-error states. Correction uses shadcn Dialog, Label, Select, Button and Alert in adjacent `-components/change-location-dialog/change-location-dialog.tsx`. The adjacent `-components/private-report-image.tsx` provides the responder query wrapper. | GET `/estates/{estateId}/reports/{reportId}`; GET `/estates/{estateId}/reports/{reportId}/images/{imageId}`; PATCH `/estates/{estateId}/reports/{reportId}/location`; locations for correction |

The list's adjacent `-components/report-filters/report-filters.tsx` renders two filter groups:
a searchable Block combobox and a Level position fieldset with Minimum position
and Maximum position searchable comboboxes matching the Block control's format.
All three controls have equal widths and align along their bottom edge on wider
screens. Level suggestions use unique numeric `sortOrder` positions in ascending
order, scoped to the selected block or across all blocks, including inactive
levels. Each level dropdown includes No minimum/No maximum to clear its bound;
custom integer bounds can also be typed even if absent from the suggestions.
Block options display names and mark
inactive blocks; values are IDs. Typing only searches the choices. Selecting a
block applies it with the current saved range; All blocks removes the block
restriction. Range comboboxes accept negative/zero integers and blank open bounds.
Apply filters validates bounds and applies the range with the selected block.
Reversed/fractional/overflow values show an accessible error without a request.
Clear filters resets both groups.

These are existing shadcn Combobox controls. Scoped `.report-filters` styling in
`src/index.css` gives their input-group wrappers a 44px minimum height, rounded
corners and card background; popups have rounded corners. The shared filter also
uses this presentation in the work-order resident-report selector. Search,
typed integer bounds and application behavior remain unchanged.

URL search fields are `blockId`, `minLevelPosition`, `maxLevelPosition`, `cursor`,
`openOnly` and `sort`. Open is the default (omitted from the URL); All uses
`openOnly=false`. The Reports shadcn Select lives in the existing FilterBar and
changing it clears the cursor. The adjacent Sort by shadcn Select defaults to
Safety and urgency (`URGENCY`, omitted from the URL) and offers Newest first
(`sort=NEWEST`) and Oldest first (`sort=OLDEST`). Changing sort preserves
location/Open/All filters and clears the cursor. Clear filters restores Open, default sorting and clears location filters.
The work-order source picker omits both queue selectors and retains all reports.
Invalid URL bounds fail route validation before report queries mount. Changing
or clearing a filter removes the cursor in the same navigation; refresh and back
restore controls. The shared `Pagination` ("Report pages"): "Previous page"
(enabled on a cursor page) clears only the cursor; "Next page" retains filters and sorting.
A failed cursor page with HTTP 400 offers Return to first page instead of Retry.
It removes only the cursor, retaining Open/All, block/range and sort. Transient
errors retain Retry on the same page; first-page errors also retain Retry.
Controls wait for location labels rather than briefly showing UUIDs. A valid
empty filtered result shows the "No matching reports" `EmptyState` with a Clear filters action; an empty estate shows "No reports yet". Position filtering uses the
backend's level `sortOrder` and includes common areas beneath matching levels.
Direct block common areas appear only when neither position bound is supplied.
The range applies across the estate when All blocks is selected; inactive
history remains readable. The old locationId subtree filter remains an API
capability, while this screen uses the replacement block/range controls.

Change location appears only with `canRelocateFaultReports` and opens once the
location choices load. The modal (the shared `FormDialog`: Cancel + "Save
location", `submitDisabled` while invalid/reloading/conflicted, and a
"Reload" `secondaryActions` button after a 409) shows current placement and editable Block,
Level and Common area controls. Parent changes clear dependent selections.
None means level-only placement; a common area can also sit directly under a
block. Selecting No level requires a block common area: the common-area control
says Choose a block common area and inline status explains disabled Save when
nothing is selected. Bare blocks remain invalid. Inactive nodes/ancestors are excluded from destinations. No active choices
produce an explanation and disabled Save. No reason or other report fields are
editable. Errors retain the selection; a 409 requires Reload before retrying.
Reload refreshes the observed location/selection. Pending saves prevent repeats.
There is no optimistic placement change. The modal hides background content
from the accessibility tree while preserving the rendered report underneath.

`apps/web/src/lib/estate-reports.ts` contains generated-client hooks. Keys begin
with authenticated user ID:

- `[userId, "estate-reports", estateId, "list", { blockId, minLevelPosition, maxLevelPosition, openOnly, sort }, cursor, 20]`
- `[userId, "estate-reports", estateId, "detail", reportId]`
- `[userId, "estate-reports", estateId, "locations"]`
- `[userId, "estate-reports", estateId, "image", reportId, imageId]`

Filter types are derived from the generated GET query contract.

Queries wait for mounted identity and the current server capability; access
failure or revocation hides report content. Requests receive cancellation signals,
have automatic retries disabled and throw returned `openapi-fetch` errors.
Detail/list and access refetch on focus. Successful correction updates detail
from the server response, invalidates the estate's report lists and affected
detail, and invalidates current-user personal report queries (including when the
responder is also the submitter). Other sessions observe corrections on refetch.
Session changes cancel/remove old-user queries. Blob URLs are revoked when image
data, identity or component lifetime changes; image requests use responder URLs.

Fault reports appears in desktop/contextual estate navigation for Manager/Crew/custom report readers,
including inactive-estate reads. Crew-only accounts land on assigned reports.
The estate dropdown uses names/capabilities from access context to switch
assigned report estates, including mixed Manager/Crew memberships. It is the
header switcher, without management estate queries for Crew. There is no
global Respond to faults entry.

The detail screen offers Create work order only with both report-read and
work-order creation capabilities and no active duplicate link. It links to the creation route with a validated
sourceReportId. Reports remain selectable after conversion; creating work does
not alter or invalidate report data. See [work-orders.md](work-orders.md).

The header uses the shared EstateFeatureSwitcher (feature `reports`) on these
pages. The context dropdown includes all accessible membership estates and labels their
estate-local roles; feature access remains capability-gated. An eligible choice
keeps the report list; other choices open a permitted management, Crew or resident
destination. Inactive Resident choices explain reporting unavailability.
Report access requires Manager/Crew membership
or custom VIEW_FAULT_REPORTS; ownership alone does not grant report authority.

## Custom estate permissions

CUSTOM VIEW_FAULT_REPORTS enters these routes with no management estate query.
The report estate switcher uses access-context labels, including custom estates.
Read-only custom responders see list/detail/private images and historical location
filters; Change location additionally requires canRelocateFaultReports from
RELOCATE_FAULT_REPORTS and an active estate. The existing query keys, correction
DTO and invalidations remain. Live definition edits/reassignment update access
and the API independently rejects stale UI authority with the same token.

## Screen states

`report-filters.tsx` renders a `FilterBar` (`search` landmark "Filter reports")
with the Block combobox and the Level position fieldset as fields, an outline
Apply filters action, and `activeCount` (block, minimum, maximum, All view, non-default sorting) / `onClear` for
the header badge and ghost Clear filters; the same toolbar appears inside the work-order report picker
dialog. List, detail, image and correction-location loads use `LoadingState`.

## Design-system pass

The list uses `ListPageHeader` (`icon={ClipboardList}`, `filters` =
`FilterToggle`; no create action). `ReportFilters` takes `id`/`open` from
`useFilterPanel(countReportFilters(filters)).barProps`, so the bar is collapsed
until toggled (open on load when the URL has filters). The detail uses
`DetailPageHeader` (breadcrumbs, `icon={ClipboardList}`) whose Create work order link has a
leading `Plus`. Load errors (reports, locations, detail, correction locations)
use `ErrorState`. Both report edit dialogs use the shared `FormDialog`, which supports disabled
submission and a Reload secondary action on conflicts. Empty states: "No reports
yet" (`ClipboardList`, "Resident reports appear here") and "No matching reports" (`SearchX`, "Try other
filters", outline Clear filters).

## Urgency queue and editing

The estate queue requests `openOnly=true` initially. The API orders Safety first,
then Urgent/High/Medium/Low and newest submission by default. Newest first
ignores urgency/Safety and uses submission time with ID as a stable tie-breaker.
Oldest first uses submission time/ID ascending, also ignoring urgency/Safety.
All three orderings run in the API before pagination. All preserves resolved
history.
Existing block/range filters and pagination retain the selected Open/All view and
sort; refresh and browser navigation restore both controls. The estate overview preview is
labelled “Fault reports by urgency” to match the same API order.

Shared `report-urgency-badges.tsx` renders stock shadcn Badges with text labels
toned by `reportUrgencyTone` (Low is outline, Medium is info, High is warning, Urgent is destructive) and a separate Safety Badge.
Estate cards/detail pass this optional metadata into shared report presentation;
resident cards/detail do not. Existing theme tokens and wrapping layouts apply.

New reports automatically start at Medium with Safety off. Managers review the
queue and manually change values where needed; report text/images are not
classified automatically. Medium can be the untouched default or a Manager's
choice. There is no separate reviewed/unreviewed marker.

Detail reads `canChangeFaultReportUrgency` and offers Change urgency only for
active-estate Managers. Adjacent folder
`reports/$reportId/-components/change-urgency-dialog/` contains the action and
`UrgencyEditor`, using existing FormDialog, Select, Checkbox, Field, Button and
Alert. Checking Safety selects/locks Urgent; unchecking retains Urgent until the
manager chooses another value. Save sends the observed `urgencyVersion` as
`expectedVersion`. Pending requests lock repeat submission and cancellation;
failures retain the draft. A 409 disables Save and offers Reload. Reload adopts
the latest values/version for review without automatically resubmitting.

`useChangeEstateReportUrgency` in `lib/estate-reports.ts` calls PATCH
`/estates/{estateId}/reports/{reportId}/urgency` through the generated client.
Success updates detail and invalidates `[userId, "estate-reports", estateId,
"list"]`; 401/403/404 refresh current-user access context. No optimistic queue
reordering occurs. Other sessions refresh through existing focus refetching.

Adjacent `latest-urgency-change.tsx` displays only the latest previous/new urgency,
Safety changes when present, available actor name (otherwise “Name unavailable”)
and time as compact metadata. A null latest change renders nothing. All recorded
events remain private in storage; no full history screen is provided.

Urgency and duplicate information share the generated `EstateIssueReport*` DTOs.
Cards retain both badge groups; detail retains duplicate review/link controls
and urgency editing. Both mutations cache the combined response, so saving either
feature preserves the other feature’s displayed data.

## Colour

`ReportMetadata` shows the status through `WorkOrderStatusBadge`, so it reads
"In progress" (warning) rather than `IN_PROGRESS`. Report status and work-order
status share one map: Open is outline, Assigned is info, In progress is warning
and Closed is success. An unknown status shows as-is, outlined.

## Routing (ID-70)

The list shows a "Routing: <state>" Badge per report and a "Routing" filter
(`routingState`). The detail page adds the routing card, with send, dismiss and
retry for work-order creators, and polls every 5 s while classifying. See
[report-routing.md](report-routing.md).
## Phones: infinite scroll

Below `md` the paged lists here scroll instead of paging: the shared `LoadMore` sentinel (see design-system.md) appends the next page of Report pages (`useEstateReportFeed`, key `[userId, "estate-reports", estateId, "feed", filters, 20]`).

