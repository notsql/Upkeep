# Inspection recording and follow-up

Routes use folder-based files under
`apps/web/src/routes/_auth/estates/$estateId/assets/`:

| Route file | Screen |
| --- | --- |
| `index.tsx` | Existing owner asset register, or `-components/inspection-asset-list.tsx` for permitted Managers/Crew |
| `$assetId/_details/route.tsx` | Layout: owner asset frame (`AssetDetailsLayout`) or, for inspection-only viewers, `$assetId/-components/inspection-asset-page.tsx` (`DetailPageHeader`, limited context, `ErrorState` on failure) |
| `$assetId/_details/records/index.tsx` | The asset's Records sub-page: Inspections first (`-components/inspection-history-table/inspection-history-table.tsx`, mounted with `offerCreate`, so its "Inspection records" `SectionCard` header carries a `sectionActionClassName` "New inspection" link (`Plus`) to `inspections/new` when `useInspectionAccess().canCreate` and the estate, asset and location are all active), then Maintenance and Documents. With the asset header's actions removed, this "New inspection" link and the layout's attention banner ("File an inspection") are where owners/managers create one. The inspection-only page also mounts the table, without `offerCreate` (its header already has Create inspection record) |
| `$assetId/_details/inspections/index.tsx` | Redirect (replace) to `…/records`; the guard admits both paths for inspection viewers |
| `$assetId/inspections/new/index.tsx` | `-components/inspection-form/inspection-form.tsx`: required explicit outcome/date, optional notes and private photos |
| `$assetId/inspections/$inspectionId/index.tsx` | `-components/inspection-detail/inspection-detail.tsx`: immutable result, evidence and follow-up |

The work-order `new/index.tsx` validates `sourceInspectionId` as a UUID,
rejecting mixed report/inspection source IDs before reading either source.
It renders the existing `-components/work-order-form/work-order-form.tsx` for all sources,
including failed inspections. There is no separate inspection work-order form.

## Access and screen composition

The authenticated guard admits the exact asset list/detail, inspection create
and saved-detail routes using estate-local capabilities. Inspection creation
requires `canCreateInspectionResults`; reads require
`canViewInspectionResults`. Asset administration, forecasts, costs, condition
and maintenance remain under their existing owner checks. Restricted views
do not mount those owner components or query hooks.

Crew can open their estate overview through `canViewEstateDetails`, reach
Assets and create work orders, without `canViewManagement` or
`canManageEstate`. Their overview omits the locations/admin section and edit,
deactivation and member-management controls. Navigation uses access-context
estate names before any authorised estate-detail response arrives; report and
work-order navigation does not issue unnecessary estate-detail queries.

Screens use shared shadcn Button, Field/Label, Input, Select, Textarea, Card,
Table, Badge and Alert components. Date controls use Singapore's calendar date, and
saved inspection dates are displayed without browser timezone conversion.
An unavailable inspector name displays **Inspector unavailable**, never an
account ID. Fail and Pass are text labels, independent of colour.

## Requests and query keys

All requests go through the generated client in `src/lib/inspections.ts`,
wrapped in React Query. Production API types alias generated schemas.

| Hook | Endpoint | Query-key shape |
| --- | --- | --- |
| `useInspectionAssets` | GET `/estates/{estateId}/inspection-assets` | `[userId, "inspection-assets", estateId, "list", q, cursor]` |
| `useInspectionAsset` | GET `/estates/{estateId}/inspection-assets/{assetId}` | `[userId, "inspection-assets", estateId, "detail", assetId]` |
| `useInspectionResults` | GET `/estates/{estateId}/assets/{assetId}/inspections` | `[userId, "inspection-results", estateId, assetId, "list", cursor]` |
| `useInspectionResult` | GET nested result detail | `[userId, "inspection-results", estateId, assetId, "detail", inspectionId]` |
| `useInspectionSource` | GET `/estates/{estateId}/inspection-results/{inspectionId}` | `[userId, "inspection-source", estateId, inspectionId]` |
| `useInspectionPhoto` | GET nested private photo | `[userId, "inspection-results", estateId, assetId, "photo", inspectionId, photoId]` |
| `useCreateInspection` | POST multipart nested result collection | Mutation; no automatic retry |

Read hooks pass cancellation signals, throw API errors, and hide cached data
when their capability is lost or the read fails. Authorization failures refresh
`[userId, "app-access"]`. Photo reads use the generated client with
`parseAs: "blob"`; browser object URLs are released on replacement, removal,
permission loss and unmount.

Saving seeds the result detail, invalidates that user's asset inspection list,
limited asset context and existing owner asset-cache prefix. Work-order
conversion invalidates work-order lists plus the specific asset's inspection
detail/history and source lookup, without invalidating other users or estates.

## Inspection history table

Pick the estate in the header switcher, then sidebar **Assets → select asset**. Both the full Owner
screen and limited Manager/Crew screen show **Inspection records** when
`canViewInspectionResults` is granted. The shared route-local component is
`$assetId/-components/inspection-history-table/inspection-history-table.tsx`.

The five columns are Inspection date, Outcome, Follow-up / work order,
Inspector and View record. The table preserves the API order (inspection date,
recording timestamp and ID descending), including separate same-day records.
Dates display the saved calendar date. Pass shows Closed; an unlinked Fail
shows only the default-style Create work order action when eligible, otherwise
its follow-up cell is empty. A linked Fail retains its failed outcome and shows
the work-order reference, linked only with independent work-order read access.
View record opens the immutable detail with notes and photos.

The table (a `SectionCard` "Inspection records", `ListChecks`) uses `useInspectionResults`, loading twenty records per page with
opaque cursor navigation through the shared `Pagination` ("Inspection history pages": Previous page / Next page). The first/last controls are disabled;
page changes replace rows. Its inner page component is keyed by user, estate
and asset, resetting cursor history when identity changes. No other asset's
cached rows are shown while loading. Revoked inspection access unmounts the
table and its actions. Failed reads hide cached rows, show an `ErrorState` with "Retry
inspections" for the same cursor. Loading and successful empty history have
distinct status messages; a history failure leaves asset context and the
recording entry point available.

`useInspectionAsset` supplies current estate/asset/location eligibility through
the limited context endpoint, sharing the restricted screen's existing query.
It introduces no owner-only reads for Managers/Crew. Create work order appears
only for unlinked Fail rows when independent creation authority and all three
active flags are present. The button-styled link carries `sourceInspectionId`
to the existing work-order creation form; browsing history performs no writes.
Cancelling returns here, leaving the unlinked Fail and its Create work order
action available to reopen the prefilled form, including after refresh.
Inactive context retains
readable history and explains why new work is unavailable. Saved inspections
and linked work orders refresh through the existing scoped invalidations.

The existing shadcn Table provides a named horizontal scroll region with
`tabIndex=0`; headers have column scope and row actions are native links.
The enclosing section can shrink inside the page. Tests cover these semantics
and focus; real-browser 320px overflow, tab order and visible focus remain
manual acceptance checks.

## Recording and recovery

The recording route's `new/-components/` folder contains:

- `inspection-form.tsx`: access/loading gates and form composition;
  `inspection-form-asset-summary.tsx` renders the page header, asset summary and
  inactive note; `use-inspection-form.ts` holds form values and selected files, observed/reviewed location, duplicate-save
  guard, mutation, saved state and navigation; the form keeps save/cancel actions.
- `inspection-fields.tsx`: controlled outcome, Singapore-date constraints and
  optional notes using shadcn Field, Select, Input and Textarea.
- `inspection-photo-field.tsx`: controlled photo selection, count/type/size
  checks and removal callbacks using shadcn Field, Input and Button. Its private
  `PhotoPreview` releases object URLs on removal and unmount.
- `inspection-form-feedback.tsx`: shadcn error Alert, location-refresh action,
  recorded/current location comparison, confirmation callback and the existing
  `inspection-save-recovery.tsx` history-check UI. Location transitions stay in
  the parent; refreshing alone never changes the submitted location.
- `saved-inspection-notice.tsx`: saved-record link and any navigation error,
  with no new submission action after saving succeeds.

The extracted UI components receive explicit props; API/query hooks stay in the
parent and the existing recovery component. See
[decision 0038](../../.spec/decisions/0038-inspection-form-component-boundaries.md).

The form has no outcome default; inspection date (a `DatePicker`, not clearable, bounded by
installation date and Singapore today) defaults to Singapore today. Asset-unavailable and
record-unavailable errors use `ErrorState`; form and record headers carry no icon.
Asset/location context is read-only. Files have previews/removal before save;
the browser checks count/type/size and the server validates content/dimensions.
Save prevents duplicate clicks and failures retain outcome/date/notes. A 409
offers location refresh followed by explicit confirmation, preserving edits.

Pass opens the saved record. Fail saves first and then opens
`/estates/$estateId/work-orders/new?sourceInspectionId=<id>` when work-order
creation is permitted (Owner/Manager). A Crew-recorded Fail returns to the
asset inspection-history table without offering conversion; Crew can still open
the saved result and any existing linked work order. A navigation failure leaves a saved-record entry point,
not another submission action. Cancelling work-order creation returns to the
asset's inspection history. The immutable result stays **Awaiting work order**
and can reopen the same prefilled form from its row or saved detail.

An ambiguous save offers an explicit canonical-history check before another
POST. `inspection-save-recovery.tsx` enables the history hook only on request,
with paged links to inspect saved records. Normal browsing uses the asset's
Inspection records table above; save-error recovery remains available in the form.

## Linked work-order form

`work-order-form.tsx` and `use-work-order-form.ts` now own the single creation
screen, form values, category/priority rules, submit guard and mutation for
manual/report/inspection sources. `use-work-order-inspection.ts` provides only
the saved inspection, observed current asset and location review/reload state.
`work-order-inspection-context.tsx` renders location review and inactive-resource
feedback plus source loading/error/Pass/already-linked states. The separate
inspection summary card is omitted because Location is already prefilled. The existing
Source and Location Select controls show the prefilled values disabled, and a
disabled Linked asset control shows the fixed asset; no editable asset picker
is mounted. Active-location queries are disabled for linked inspections because
their location comes from the limited asset endpoint. Description, category and
priority use the same controls as all other work orders. Cancel remains enabled
while location review blocks creation, and disables only during an active save.
See [decision 0039](../../.spec/decisions/0039-unified-work-order-creation.md).

The server-authorised source lookup supplies the asset ID; the browser then
loads that asset's limited current context. Source and asset remain fixed.
Notes prefill the editable description once, so background reads do not erase
edits. Missing notes leave a required empty description. Existing category and
priority rules apply, including Safety forcing Urgent.

Recorded inspection location and current work location appear together only in
the move review alert. An initial move requires confirmation; a later 409
requires reload/review again.
The POST carries source INSPECTION, `sourceInspectionId`, fixed `assetId`,
current `locationId` and `expectedSourceLocationId`. Retired/inactive resources
show why creation is blocked. Already linked sources display the existing
work-order reference instead of a fresh creation form. A closed work order
does not turn the saved Fail into Pass.

## Shared page components

The create page (`inspection-form.tsx`) is a `FormPage` "Create inspection
record" (breadcrumbs `<asset name> › Create inspection record`, "Asset" while
loading; description "<reference> · <name>", no icon). Access loading, the
not-allowed alert, asset errors and asset loading all render inside it. Then a
`FormCard` "Asset" (`inspection-form-asset-summary.tsx`: Asset and Location,
plus a destructive `Alert` when the estate, asset or location is inactive), and
the form in a `FormCard`: `FieldSet` "Result" (Outcome and Inspection date side
by side from `sm`, then Notes (optional)), `FieldSeparator`, `FieldSet`
"Evidence" (Photos (optional)), feedback, and `FormActions` "Save inspection
record" ("Saving…" while pending; submit also disabled while inactive or a
location review is open; Cancel navigates to the asset). After saving,
`saved-inspection-notice.tsx` is a `FormPage` "Inspection saved" with a
`FormCard` holding the "View saved inspection" link, and the record page
(`inspection-detail.tsx`) uses `DetailPageHeader` with the Pass/Fail `Badge` as
`status` and "<reference> · <name>" as `meta` (no estate-name fallback). Asset
and record load failures use `ErrorState` ("Retry asset", "Retry inspection").

## A Fail needs a note (equipment dispatch)

With Fail chosen the notes field is labelled "Notes: what's wrong?" and is
required; saving it blank shows "Say what's wrong so the manager knows what to
fix." and sends nothing. See [equipment-dispatch.md](equipment-dispatch.md).
