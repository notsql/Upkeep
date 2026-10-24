# Estate fault report screens

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
`_auth` authenticates and checks the requested estate's `canViewFaultReports`
before any child query can mount. Crew and custom report readers can enter report routes without general
management rights. Council/Resident membership and provider-admin claims cannot
bypass this capability. Personal `/reports` history remains separate.

| Route folder | Screen and components | API calls |
| --- | --- | --- |
| `reports/index.tsx` → `/estates/{estateId}/reports` | Shared report cards with linked title, labelled estate name, full location path, status Badge and submission time. shadcn Card, Label, Combobox, Button and Alert. URL block/level-position filters, All blocks/clear, loading/retry, empty/no-matches and cursor pagination. | GET `/estates/{estateId}/reports`; GET `/estates/{estateId}/locations?includeInactive=true`; access context |
| `reports/$reportId/index.tsx` → `/estates/{estateId}/reports/{reportId}` | Shared report Card/Badge and metadata, Updated timestamp, complete plain-text description, private images and empty/image-error states. Correction uses shadcn Dialog, Label, Select, Button and Alert in adjacent `-components/change-location-dialog.tsx`. The adjacent `-components/private-report-image.tsx` provides the responder query wrapper. | GET `/estates/{estateId}/reports/{reportId}`; GET `/estates/{estateId}/reports/{reportId}/images/{imageId}`; PATCH `/estates/{estateId}/reports/{reportId}/location`; locations for correction |

The list's adjacent `-components/report-filters.tsx` renders two filter groups:
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

URL search fields are `blockId`, `minLevelPosition`, `maxLevelPosition`, `cursor`.
Invalid URL bounds fail route validation before report queries mount. Changing
or clearing a filter removes the cursor in the same navigation; refresh and back
restore controls. First page clears only the cursor; Next retains both filters.
Controls wait for location labels rather than briefly showing UUIDs. A valid
empty filtered result shows "No matching reports." Position filtering uses the
backend's level `sortOrder` and includes common areas beneath matching levels.
Direct block common areas appear only when neither position bound is supplied.
The range applies across the estate when All blocks is selected; inactive
history remains readable. The old locationId subtree filter remains an API
capability, while this screen uses the replacement block/range controls.

Change location appears only with `canRelocateFaultReports` and opens once the
location choices load. The modal shows current placement and editable Block,
Level and Common area controls. Parent changes clear dependent selections.
None means level-only placement; a common area can also sit directly under a
block. Inactive nodes/ancestors are excluded from destinations. No active choices
produce an explanation and disabled Save. No reason or other report fields are
editable. Errors retain the selection; a 409 requires Reload before retrying.
Reload refreshes the observed location/selection. Pending saves prevent repeats.
There is no optimistic placement change. The modal hides background content
from the accessibility tree while preserving the rendered report underneath.

`apps/web/src/lib/estate-reports.ts` contains generated-client hooks. Keys begin
with authenticated user ID:

- `[userId, "estate-reports", estateId, "list", { blockId, minLevelPosition, maxLevelPosition }, cursor, 20]`
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
The Report estate Select uses names/capabilities from access context to switch
assigned report estates, including mixed Manager/Crew memberships. It appears
on report pages and on Crew estate navigation, without management estate queries
for Crew or overview access. Outside a report-capable estate, Respond to faults
provides an entry to an assigned report estate on desktop and mobile overflow.

## Custom estate permissions

CUSTOM VIEW_FAULT_REPORTS enters these routes with no management estate query.
The report estate switcher uses access-context labels, including custom estates.
Read-only custom responders see list/detail/private images and historical location
filters; Change location additionally requires canRelocateFaultReports from
RELOCATE_FAULT_REPORTS and an active estate. The existing query keys, correction
DTO and invalidations remain. Live definition edits/reassignment update access
and the API independently rejects stale UI authority with the same token.
