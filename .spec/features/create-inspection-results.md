# Create asset inspection results

**Status:** implementation approved by the user on 2026-10-26
**History table:** implemented and automated checks passed on 2026-10-26 after the plan and failing tests; real-browser acceptance remains manual
**Owner:** to be assigned
**Dependencies:** ID-36 (work-order creation)
**Related:** ID-49 (broader asset history; reuse this inspection table)

## Form component refactor (agreed 2026-10-26)

The user approved splitting the existing recording form into route-local
components without changing behaviour. Keep access, form values, selected
files, observed/reviewed location, duplicate-save protection, mutation and
navigation in `InspectionForm`. Extract controlled outcome/date/notes fields,
photo selection/validation/previews, feedback/location-review/recovery UI and
the existing saved-record notice into sibling files in `new/-components/`.
Photo previews retain their object-URL cleanup; only explicit confirmation
updates the location submitted on retry. A successful save followed by failed
navigation still offers the saved record without another submission action.
Keep the existing shadcn controls, page layout, API and generated types.
Run the current interaction tests before extraction and add regression coverage
for photo removal, location confirmation and navigation failure after save.

## One work-order creation flow (agreed 2026-10-26)

The user explicitly requested the existing create-work-order form for failed
inspections, replacing the separate inspection work-order form. Extend
`WorkOrderForm` and `useWorkOrderForm` to accept `sourceInspectionId`; all sources
share one form, state and submission handler. The server-loaded inspection
prefills notes as description, source Inspection, its fixed asset and current
location. Source/location controls and the linked asset remain locked for a
saved inspection; description, category and priority remain editable. Preserve
one-time prefilling, Safety forcing Urgent, current-location confirmation,
409 reload/review, active-resource checks and already-linked/Pass guards.

Saving a Fail opens that existing form only after the inspection is saved.
Cancel returns to the asset's inspection history without creating any work
order or deleting/changing the inspection. An unlinked Fail retains a visible
Create work order action that reopens the same prefilled form, including after
refresh. Once linked, show the existing work-order reference instead. Creation
remains separately permission-gated and never automatically retries. Add and
run failing interaction tests for prefills, cancellation/reopening and conflict
recovery before implementation. No API or database changes.

## Problem

Technicians cannot record the outcome of an asset check or reliably turn a
failed check into traceable work. The asset record needs to retain the outcome,
inspection date and supporting evidence, including when work-order creation is
cancelled or completed later.

## Confirmed decisions

- Owners, Managers and Crew can view and create inspection results in their
  authorised estates. Authority is estate-local and checked by the server.
- Crew have read-only work-order access. Owners/Managers create and update
  work orders; Crew can record failures for them to convert later. This revised
  policy is specified in [Crew read-only work orders](crew-work-orders-read-only.md)
  and decision 0040.
- Crew have read-only access to their assigned estates: they can browse estate
  details and reach assets/inspection actions, but cannot edit estate details,
  deactivate an estate, transfer ownership or administer its members/locations
  through this feature. Inspection recording and work-order reads are separate granted
  actions. This estate-local restriction does not change self-service creation
  of a new estate, whose creator becomes its Owner.
- Save a failed result first, then open the work-order creation form with the
  asset and location prefilled. A failed result remains flagged for follow-up
  until a saved work order is linked. Submission does not automatically create
  the work order.
- Entry point: Estates > Assets > an asset, such as a lift > **Create inspection
  record**.
- The form contains a required pass/fail outcome, an inspection date defaulting
  to today, optional notes and optional photo attachments.
- For this feature, each submission is a standalone asset inspection result.
  Generating a monthly list of due checks is a separate, currently out-of-scope
  story; recording a result does not require a generated or scheduled check.
- The inspection records table is included in this feature. The user revised
  the earlier ID-49 deferral on 2026-10-26. Reuse the saved records, read contract
  and work-order links already supplied for ID-49; render one table on each
  asset detail screen, including the limited Manager/Crew view.
  Each row displays the inspection date and pass/fail result; failed rows link
  to their work order or offer its creation where the user has permission.
- Limits/policies agreed on 2026-10-25: Singapore date validation (no future dates
  or dates before known installation); notes up to 2,000 trimmed characters; up
  to three JPEG/PNG photos, 5 MB each, maximum 4,032 by 3,024 pixels; append-only
  saved results/evidence; at most one linked work order per inspection result.

## Existing system and proposed scope

The original schema had no inspection/check model. AssetEvent records maintenance;
AssetAssessment records condition. Neither represents an inspection pass/fail.
Existing asset history surfaces are described in
[asset events](../../.docs/api/asset-events.md) and
[asset screens](../../.docs/frontend/assets.md). Add a dedicated inspection
record rather than treating a failed inspection as a repair or condition
assessment. The recording API, generated types, read hooks and saved-detail
screens are now implemented. This plan also includes the missing inspection
history table on asset details. It consumes those canonical records directly;
ID-49 must reuse this surface rather than introduce a duplicate table.

[ID-36](create-work-order.md) already supports source `INSPECTION`, currently
with a manually entered source reference. This feature adds the deferred link
to a saved inspection while retaining existing manual inspection-source orders.
Work-order creation currently permits Owners and Managers; Crew can read orders.
The revised policy retains Owner/Manager-only creation and its limited asset
picker. API guards, access capabilities and the form agree; Crew have read access
and cannot enter creation through direct requests or source handoffs.

Asset register/detail/history APIs currently remain owner-only. The agreed
inspection roles therefore require navigation and limited asset context for
Managers and Crew. Proposed approach: reuse the Assets URLs with a restricted
inspection view for those users, backed by limited read endpoints. Preserve
owner-only asset administration, costs, forecasts and other history permissions.
Estate list/detail reads currently exclude Crew as well. Extend those reads to
current estate-local Crew membership and render a read-only estate summary with
an Assets entry point. Keep estate-read permission separate from estate editing,
membership administration and management-dashboard data.

One submitted record represents one completed inspection of an asset. Pass
means that inspection is finished with no work-order follow-up; it does not
update a scheduled-check task in this version. Fail retains follow-up until a
work order is linked. Multiple records on the same asset/date remain valid
independent inspections.

### Future monthly inspection list — out of scope

The separate story will generate due checks for flagged asset classes, use
service intervals when no prediction exists, group checks by block/level and
avoid duplicating checks on regeneration. It depends on the location registry
(ID-6) and service intervals (ID-7). Those generation rules and dependencies do
not block manually recording inspection results in this feature.

When that story is planned, define the generated-check lifecycle and how a
technician opens this result form from a due check. That future feature will
link the saved result to the generated check and define its completion and
regeneration rules. Do not add placeholder scheduled-check tables, IDs, nullable
relations or deduplication machinery to this feature in anticipation of it.

## Behaviour

### Access and recording

1. An authenticated current Owner, Manager or Crew member can list and view
   inspection results for that estate. In an active estate, they can record a
   result against an active asset with an active location hierarchy. Inactive
   estates and retired assets retain readable inspection history.
2. A same-estate Resident membership overrides conflicting ownership, consistent
   with existing management policies. Council, Member, custom roles without
   independent qualifying ownership, unassigned users and provider-admin claims
   alone grant no inspection authority. Authority in one estate grants none in
   another. Cross-estate asset, inspection, image and work-order IDs are rejected,
   including when the caller can access both estates.
3. The server derives the inspector from the authenticated identity and validates
   current membership after acquiring the estate-first write locks. Clients
   cannot choose the inspector or override estate/asset associations.
4. The form shows the asset reference/name and location as read-only context.
   Outcome has no default; the user must explicitly select Pass or Fail. The
   inspection date is required and defaults to today's Singapore calendar date
   when the form opens. Reject future dates and dates before
   a known installation date, using the same Singapore date boundary server-side.
5. Notes are optional; whitespace-only input becomes null. The maximum is
   2,000 characters after trimming. Photos are optional. Agreed limits match
   resident-report uploads: at most three JPEG/PNG files, 5 MB per file, maximum
   dimensions 4,032 by 3,024 pixels. Validate content, size and dimensions on the
   server, not just the filename or browser-provided MIME type.
6. Save records the outcome, inspection date, notes, private photo metadata,
   inspector and server recording timestamp. Asset/location identity and a
   displayable location path are captured at submission. A moved asset causes a
   conflict against the location observed in the form; require explicit refresh
   and review while retaining entered notes/outcome/date.
7. A saved Pass closes that check. It has no outstanding follow-up and offers no
   work-order creation action. A later inspection creates another record rather
   than replacing this result.

### Failure and work-order handoff

8. A saved Fail has the follow-up state **Awaiting work order**, exposed to
   the asset's inspection history table and the saved inspection detail.
   The record and evidence remain saved if navigation fails, the work-order
   form is cancelled, or work-order creation fails.
9. For a caller with `canCreateWorkOrders`, successful Fail submission navigates
   to `/estates/$estateId/work-orders/new?sourceInspectionId=<saved ID>`.
   The form loads authorised source data from the server and prefills source
   `INSPECTION`, asset and location. Notes may prefill an editable description;
   an empty description still requires entry. Existing category and priority
   requirements, including Urgent for Safety, continue to apply.
10. The inspection identity and asset remain fixed during source conversion.
    The work location must equal the asset's current registered location, per
    ID-36. If the asset moved since inspection, show both the recorded location
    and current work location and require explicit confirmation. A subsequent
    move while the form is open returns 409 and requires another review. The
    inspection's historical location is never rewritten.
11. Owners/Managers saving a Fail open the prefilled work-order form and can
    resume creation from the saved result or inspection history. Crew saving a
    Fail return to asset inspection history; they retain inspection recording
    and work-order reads but cannot create, start, complete or correct an order.
    Crew remain unable to edit estate details or asset master data.
12. The work-order creation transaction validates current permissions and that
    the source is a same-estate failed inspection for the linked asset. It saves
    the work order and its inspection relation together. Agreed first version:
    at most one work order per inspection; concurrent conversions cannot create
    two linked orders. A conversion conflict identifies that work already exists
    so the user can open it. Reopening a linked source never presents a fresh
    creation form as though it had no work order.
13. Once an order is saved, the inspection row replaces **Awaiting work order**
    with its reference linked to work-order details. The failed outcome remains
    Fail regardless of work-order progress or closure. Closing a work order does
    not change the historical result to Pass; a new check records a new outcome.
14. Existing manually entered `INSPECTION` source orders remain readable and
    creatable. New linked conversion adds a real source ID; it does not backfill
    historical free-text references or replace resident-report conversion.

### History and evidence

15. This feature adds an **Inspection records** table to both full Owner and
    limited Manager/Crew asset details, ordered by inspection date
    descending, then recording timestamp and ID descending. Columns: inspection
    date, Pass/Fail, follow-up/work order, inspector and View record. Notes and
    photo indicators can appear in the row; full notes and photos are available
    in the record detail. No records shows **No inspection records yet**.
16. Saving either outcome adds exactly one canonical inspection record for
    the table to read. The table uses the inspection read contract directly,
    so a separate history write cannot fail after the inspection succeeds.
    Reuse the existing scoped invalidations; do not insert a duplicate AssetEvent or alter
    condition, forecast inputs, maintenance costs or equipment lifecycle.
17. Photo reads require current inspection access and enforce the full
    estate/asset/inspection/photo relationship. Storage keys and public bucket
    URLs are never returned. Revocation removes access to records and photos,
    including the inspector's own submissions. History remains available after
    retirement to users who retain estate authority.
18. Agreed audit policy: saved results and evidence are append-only in this
    version. No edit/delete action is offered. The linked work order and its
    progress remain separate from the immutable inspection outcome.

### Inspection history table

19. The named table has five columns: **Inspection date**, **Outcome**,
    **Follow-up / work order**, **Inspector**, and **View record**. Dates display
    the saved calendar date without timezone conversion; Pass/Fail are text.
    Render records in the server's canonical order, preserving distinct
    same-day records. An unavailable name displays **Inspector unavailable**,
    never the recorded account ID. Each row has a **View record** link to its
    saved detail; notes and photos remain on that detail screen.
20. Pass displays **Closed** and no conversion action. An unlinked Fail displays
    **Awaiting work order** and a **Create work order** link with only the saved
    `sourceInspectionId` when the user retains work-order creation authority
    and the estate, asset and current location are active. A linked Fail stays
    Fail and displays its existing work-order reference instead of creation;
    link the reference only with work-order read authority, otherwise show text.
21. Load twenty records per page through `useInspectionResults`. **Next** uses
    the returned opaque cursor; **Previous** returns to the preceding page.
    Disable Previous on the first page and Next on the last page. Replace the
    visible page rather than append records. Reset pagination when the estate
    or asset changes; never show another asset's cached rows while loading.
22. Pending reads show a status **Loading inspection records…**, without an empty
    message. A successful empty first page shows **No inspection records yet**
    without row actions. Failures show an alert and **Retry inspections** for
    the failed page, without an empty message or stale cached rows. A history
    failure does not hide the asset context or prevent opening the record form.
23. Inspection read capability gates both the table and its requests separately
    from asset administration. Permission revocation or a denied history read
    hides cached rows and follow-up actions. Managers/Crew must not request
    owner-only asset, assessment, maintenance, device or forecast data to read
    this table. Inactive estate/location or retired asset context preserves
    history reads while suppressing creation actions.
24. Returning to the asset after a save shows the new record exactly once.
    Refetching history after linked work-order creation replaces the awaiting
    state with the reference without changing Fail or duplicating the row.
    Continue using user/estate/asset-scoped query keys and invalidations.
25. Use the existing shadcn Table, Badge, Button and Alert components. The table
    has an accessible name and semantic headers; record/work-order actions use
    real links. Its horizontal scroll region can receive keyboard focus and
    keeps overflow within the table at a 320px viewport. Browser verification
    covers actual tab order, focus visibility and overflow; jsdom tests cover
    semantics, links and a focusable scroll region.

## Data

The history table adds no schema changes. It reads the existing
`AssetInspectionResult` and optional linked `WorkOrder` through the API below.

All shape changes start in `packages/db/prisma/schema/schema.prisma` and use
Prisma migrations; regenerate Prisma and typed jOOQ sources. Proposed models:

| Model | Fields / changes |
| --- | --- |
| `AssetInspectionResult` | `id`, `estateId`, `assetId`, `locationId` UUIDs; `locationPath` snapshot; `outcome` PASS/FAIL; `inspectedOn` date; nullable `notes` up to 2,000; `recordedByUserId`; nullable inspector display-name snapshot; server `createdAt` |
| `AssetInspectionPhoto` | `id`, `estateId`, `inspectionResultId` UUIDs; private `storageKey`; validated `contentType`; `sizeBytes`; server `createdAt` |
| `WorkOrder` | Add nullable `sourceInspectionId` with same-estate FK and uniqueness for the agreed one-order-per-inspection rule; retain `sourceReference` for existing manual provenance |
| `Asset`, `Estate`, `Location` | Reverse relations and composite keys required to enforce the same-estate relations; no change to asset lifecycle or maintenance records |

Index inspection history by `(estateId, assetId, inspectedOn, createdAt, id)`.
Use composite foreign keys for estate-bound associations and restricted deletion.
Follow-up is derived: Pass = Closed; Fail without linked order = Awaiting work
order; Fail with linked order = Work order raised. Do not add a duplicate mutable
follow-up field or copy work-order status into the inspection table.

The migration must be additive so deployed code remains compatible. No new
packages are planned. Reuse existing private R2 storage infrastructure where
appropriate without granting access through resident-report APIs.

## API

The history table adds no endpoints or DTOs. Reuse GET
`/estates/{estateId}/assets/{assetId}/inspections` and its existing opaque
cursor contract through the generated client and `useInspectionResults`.

Implemented endpoints. Inspection
endpoints require authenticated identity and estate-local inspection authority;
reused estate/work-order endpoints enforce their independent role rules below.
Success responses are private/no-store; photo responses additionally have the
validated media type.

Base path below: `/estates/{estateId}`.

| Method | Path after base | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates` (existing; no estate base) | Existing optional status filter | 200 existing `EstateResponse[]`, now including assigned Crew estates | Existing readers plus current same-estate Crew |
| GET | `/estates/{estateId}` (existing; no extra estate base) | Path ID | 200 existing `EstateResponse` | Existing readers plus current same-estate Crew; read-only |
| GET | `/inspection-assets` | Optional `q`, `cursor`, `limit` (default 20, max 50) | 200 `InspectionAssetPageResponse` | Owner/Manager/Crew; includes historical inactive context |
| GET | `/inspection-assets/{assetId}` | Path IDs | 200 `InspectionAssetResponse` | Owner/Manager/Crew |
| GET | `/inspection-results/{inspectionId}` | Path IDs; resolves the asset server-side for conversion | 200 `InspectionResultResponse` | Owner/Manager/Crew |
| POST | `/assets/{assetId}/inspections` | Multipart `outcome`, `inspectedOn`, optional `notes`, optional repeated `photos`, required `expectedLocationId` | 201 `InspectionResultResponse`; Location header | Owner/Manager/Crew; active estate, asset and location |
| GET | `/assets/{assetId}/inspections` | Optional `cursor`, `limit` (default 20, max 50) | 200 `InspectionResultPageResponse` | Owner/Manager/Crew |
| GET | `/assets/{assetId}/inspections/{inspectionId}` | Path IDs | 200 `InspectionResultResponse` | Owner/Manager/Crew |
| GET | `/assets/{assetId}/inspections/{inspectionId}/photos/{photoId}` | Path IDs | 200 private image bytes | Owner/Manager/Crew |
| POST | `/work-orders` (existing, extended) | Existing `CreateWorkOrderRequest` plus optional `sourceInspectionId` and observed current asset location | 201 `WorkOrderResponse` with nullable `sourceInspectionId` | Owner/Manager in an active estate |
| GET | `/work-order-assets` (existing, extended permission) | Existing query/cursor/limit | 200 existing asset picker page | Owner/Manager with active-estate creation authority |
| GET | `/access/context` (existing, extended; no estate base) | None | Existing response plus estate inspection capabilities | Authenticated |

DTO outline:

- `InspectionAssetResponse`: `id`, `estateId`, `locationId` UUIDs; `reference`,
  `name`, `category`, `locationPath` strings; nullable `installedOn` date;
  `estateActive`, `assetActive`, `locationActive` booleans. No costs, sensors,
  forecasts or unrelated history. Used only for the restricted asset views.
- `InspectionResultResponse`: `id`, `estateId`, `assetId`, `locationId` UUIDs;
  `locationPath` snapshot; `outcome` PASS/FAIL; `inspectedOn` date; nullable
  `notes`; `recordedByUserId`, nullable `recordedByName`; `createdAt` timestamp;
  `photos: { id: UUID, contentType: string }[]`; nullable
  `workOrder: { id: UUID, reference: string }`. Inspector names have an explicit
  unavailable fallback. Do not display account IDs as names.
- Page responses: `items` array and nullable opaque `nextCursor`. Scope cursors
  to the authorised estate/asset and use deterministic ordering.
- `EstateAccessResponse`: add `canViewInspectionResults` and
  `canCreateInspectionResults`; the latter also requires an active estate.
  Asset activity is checked per request. These capabilities do not imply
  `canViewAssets`, `canViewManagement` or `canCreateWorkOrders`. Keep
  `canCreateWorkOrders` Owner/Manager-only and add an explicit estate-details
  read capability, such as `canViewEstateDetails`, for current estate readers
  including Crew. Keep Crew's `canManageEstate` false and do not reuse a broad
  dashboard/management grant just to admit estate reads. Preserve independent
  ownership authority if an account is an Owner as well as having membership.
- Extend work-order request validation: linked inspection sources require Fail,
  the matching asset, and the current observed asset location; reject mixed
  resident-report/inspection source IDs or source IDs on unrelated source types.
  Retain required source text for legacy unlinked inspection orders. Linked
  orders can derive their source reference from the inspection ID/date.

Errors use existing `EstateError`: 400 invalid outcome/date/text/source/cursor;
401 missing identity; 403 insufficient known estate role; 404 inaccessible or
missing related record; 409 inactive resources, stale location or already-linked
inspection; 413 oversized upload; 415 unsupported image; 503 unavailable storage.
Check authorisation before revealing or uploading evidence.

## Frontend

Keep folder-based routes under
`apps/web/src/routes/_auth/estates/$estateId/assets/`:

| Route file | Purpose |
| --- | --- |
| `index.tsx` (existing) | Full owner register or limited inspection asset list for Manager/Crew |
| `$assetId/index.tsx` (existing) | Owner details or limited Manager/Crew asset context, with Create inspection record and the Inspection records table |
| `$assetId/inspections/new/index.tsx` | Create inspection result form |
| `$assetId/inspections/$inspectionId/index.tsx` | Saved result, notes/photos and work-order follow-up |

Route-local components belong in their route's `-components/` folder. Use
existing shadcn Button, Select, Input, Textarea, Field, Card, Table, Badge and
Alert components as applicable to the form/detail and history table.
Share the table in `$assetId/-components/inspection-history-table.tsx`, mounted
by both `asset-details-page.tsx` and `inspection-asset-page.tsx`. It owns the
current cursor and preceding cursors; reset these when route identity changes.
Reuse `useInspectionResults` without hand-written API types or direct component
API calls. Label Pass/Fail in text and
retain keyboard access and visible validation. Provide photo preview/removal before submission, loading, retry and
empty states. Save disables duplicate clicks; failures retain entered values.

Update the authenticated route guard and estate navigation to admit the exact
inspection list/detail/create routes for the new capabilities. Do not rely on
the current owner-only `canViewAssets` or management route gate. Restricted
views must not mount owner-only hooks/components. Extend the existing estate
directory and estate detail route to admit Crew estate reads. Render a read-only
estate summary with an Assets link for Crew; do not mount management dashboard,
member administration or estate edit controls based on read permission. Use
access context for labels before the authorised estate detail query resolves.
Edit/retire/restore,
maintenance, condition, cost and forecast routes keep their existing authority.

Add hooks in `apps/web/src/lib/inspections.ts` using the generated typed client
and React Query. Keys begin with the user ID and include estate/asset, e.g.
`[userId, "inspection-results", estateId, assetId, ...]` and
`[userId, "inspection-assets", estateId, ...]`. Use the generated client for
multipart submissions and authorised image reads; release browser object URLs.
Refresh access context and hide inaccessible cached data on revocation.

On inspection save, seed detail and invalidate that user's asset inspection
history. On linked work-order creation, invalidate the inspection detail/history
as well as existing work-order lists. Existing owner asset caches use their
current key helpers. Extend work-order creation's URL validation to accept
`sourceInspectionId`, rejecting mixed source IDs, and load/validate the record
server-side. Prefill once so background refreshes cannot overwrite edits.

## Edge cases

- Cancelling work-order creation leaves a persistent failed row and a working
  retry entry point. Returning later or refreshing restores its follow-up state.
- A Crew-recorded failure returns to history and is visible to the estate's
  Owners/Managers/Crew. Owners/Managers can convert it. If creation authority is
  revoked during handoff, keep the result and deny work-order writes.
- A concurrent conversion links at most one order. Work-order creation rollback
  leaves the inspection awaiting work; a failed history refresh cannot erase it.
- Do not automatically retry creation POSTs. After an ambiguous inspection-save
  response, offer history refresh and let the user check whether the result was
  saved before submitting again. Browser duplicate-click prevention does not
  promise server-side idempotency for inspection submission.
- Evidence upload failure leaves no submitted result. If database persistence
  fails after uploading, clean up uploaded objects; cleanup failure is logged for
  retry without reporting success or exposing provider details. Photo-free
  submissions work when photo storage is unavailable. Recheck permissions and
  active state inside the transaction after uploads.
- Retiring an asset, deactivating its estate/location, or removing the inspector's
  role while submission waits must prevent the write after the estate lock is
  acquired. Saved history stays intact. Location snapshots survive later moves
  and renaming.
- A failed inspection for an asset retired before work-order creation remains
  visible, but the current ID-36 policy blocks linking retired assets. Show the
  reason rather than silently creating an unlinked order or clearing the flag.
- Missing optional notes/photos, backdated inspections, same-day multiple
  inspections, unavailable display names and unavailable photo storage have
  explicit readable states. Ordering does not depend on the browser timezone.
- A failed second-page read retries that cursor; pagination never silently
  restarts at the first page. Switching assets resets the page even when the
  router reuses the asset screen. Empty, loading and error are distinct states.
- A direct foreign image URL, forged prefill query, stale cached role or role in
  another estate cannot bypass server checks. All new method/path combinations
  require explicit Spring Security rules; unsupported methods remain denied.
- Crew estate reads never grant estate mutation, asset administration or
  work-order progress/completion authority. Test direct mutation requests as well
  as hidden controls. Removing Crew membership immediately revokes its estate
  reads and inspection recording rights; Manager-to-Crew demotion immediately
  revokes work-order creation and updates, including queued creation requests.

## Acceptance and verification plan

| Scenario | Observable result |
| --- | --- |
| Save Pass with only required fields | Check closed; one history row; no work-order redirect/action |
| Save Fail as Owner/Manager | Result saved first; prefilled creation opens; cancelling leaves Awaiting work order |
| Save Fail as Crew | Result saved first; asset inspection history opens without creation controls; Owner/Manager can convert later |
| Complete the linked order form | One Open work order with correct estate/asset/location/source; inspection row links to it |
| Attach notes/photos | Evidence persists and is readable only under current estate inspection authority |
| Browse an assigned estate as Crew | Estate details and asset inspection entry points are visible; estate editing/admin remain denied |
| Open asset details as Owner/Manager/Crew | Inspection records table loads without requiring owner-only reads for Manager/Crew |
| Browse multiple history pages and switch assets | Server order retained; Next/Previous use opaque cursors; new asset starts on its first page |
| Refresh asset history after saving or linking work | Inspection date, outcome and current link remain visible once per result |
| History loading, empty, failed or revoked | Distinct readable states; retry recovers the failed page; inaccessible cached rows disappear |
| Open inactive/retired asset context | Saved records remain readable; work-order creation is unavailable |
| Use keyboard and a 320px screen | Named semantic table, focusable scroll region and usable links; no page overflow |
| Change role or forge related IDs | Server denies unauthorised list/detail/create/photo/conversion requests without side effects |
| Race moves/deactivation/conversion | Conflicts preserve saved results/evidence and prevent stale or duplicate work links |
| Close linked work order | Original Fail remains; completion uses existing work-order history semantics |

## Implementation phases

Test-first history and implementation verification are recorded in
[create-inspection-results-tests.md](create-inspection-results-tests.md).

- [x] Obtain final human agreement of this complete spec before implementation;
  the scope decisions below are resolved.
- [x] Write and run failing server tests for the authorised role matrix, form
  validation, Pass/Fail persistence, history reads, private photos and failure
  paths, including read-only Crew estate access with denied estate mutations.
- [x] Add additive Prisma models/migration and regenerated Prisma/jOOQ sources;
  implement the smallest service/repository/controller changes that pass tests.
- [x] Write and observe failing work-order integration tests; add the persisted
  source relation, current-location checks and concurrent conversion protection.
  Verify Owner/Manager creation and its limited asset picker, denied Crew direct
  API/create-route/manual/source creation, and retained Crew inspection reads.
- [x] Regenerate `packages/api/openapi.json` and `packages/api/src/schema.ts`
  through `pnpm api:generate`; never hand-write frontend API types.
- [x] Write and run failing Vitest/Testing Library tests for each role's actual
  routes, form behaviour, retained input, history read integration and conversion/
  cancellation. Implement hooks, read-only Crew estate views, restricted asset
  navigation, inspection form/detail UI and the Crew read-only work-order flow.
- [x] Supply ID-49 with the canonical read hooks and scoped invalidation contract.
- [x] Write and run failing route-level table tests for behaviours 19–25 using
  the existing generated route tree and mocked HTTP boundary. Record the red
  stage separately from the previously completed recording implementation.
- [x] Implement the shared Inspection records table on both asset detail views;
  verify dates, outcomes, inspector fallback, work links/create actions,
  pagination, error recovery, access and scoped invalidation together.
- [x] After table implementation, rerun relevant Nx tests, `pnpm check-types`,
  `pnpm test` and `pnpm fix`; update the matching as-built frontend docs.
- [x] Run relevant checks through Nx, then `pnpm check-types`, `pnpm test` and
  `pnpm fix`; verify the production web build. Do not install packages.
- [ ] Manually check narrow layouts, keyboard use, live private R2 evidence and
  each role's signed-in handoff. This environment has no browser installed.
- [x] Add `.docs/api/inspections.md` and `.docs/frontend/inspections.md`; update
  `.docs/README.md` and matching assets, work-orders, access and shell docs with
  the system as built. Record the chosen source/history/access design in a new
  decision note. Leave changes uncommitted for the human.

## Out of scope

- Monthly inspection-list generation, flagged-class selection, due-date
  calculation from predictions/service intervals, block/level grouping and
  deduplication of generated checks. These belong to the separate list story.
- Scheduled/recurring inspection task lifecycles, checklist templates and
  multiple checks per inspection, offline drafts, signatures and approvals.
- Automatic work-order creation, notifications, escalation or provider assignment.
- General asset administration and Crew estate editing/member administration.
- Work-order progress/completion permission changes; these remain Owner/Manager-only.
- Other ID-49 history features, global inspection search/filtering and client
  column sorting; this table follows the existing canonical server order.
- Editing/deleting saved inspection results, migrating old free-text inspection
  references, and multiple work orders for one result in the agreed first version.
- Automatically changing asset condition, forecasts, costs or repairing/retiring
  an asset because an inspection failed.
- A global inspection dashboard or general rewrite of existing asset history.

## Review decisions

No open scope questions remain for result recording. The user approved
implementation on 2026-10-26 and subsequently requested including the history
table in this plan and writing its tests first, then authorised implementation.
The table is implemented; real-browser acceptance remains outstanding.
Original question numbers
are retained below for reference.

1. **Crew handoff — revised on 2026-10-26:** Crew record inspections and read
   work orders, while Owners/Managers create orders. Crew failures return to
   asset history for later Owner/Manager conversion. Decision 0040 supersedes
   the earlier Crew-creation agreement.
2. **Meaning of check — resolved on 2026-10-25:** record standalone asset-level
   Pass/Fail results now. The monthly due-inspection list is a separate story
   and is explicitly out of scope. Its generated-check lifecycle/link to results
   will be specified when that story is planned.
3. **History scope — revised on 2026-10-26:** the original 2026-10-25 agreement
   deferred the table to ID-49. The user's new instruction includes the table
   in this inspection feature and requests the plan and tests before building
   it. Reuse the existing records/read hooks and render the table on both asset
   views; broader ID-49 history remains separate.
4. **Limits/policies — agreed on 2026-10-25:** Singapore date validation,
   2,000-character notes, up to three photos with existing upload limits,
   append-only results, and one linked work order per result. No decision remains
   for this item; its number is retained for review references.
5. **Crew estate access — clarified on 2026-10-25:** Crew can view their assigned
   estates without estate-edit/admin authority, while retaining inspection and
   work-order creation. The limited asset context remains the proposed way to
   reach those actions without exposing unrelated owner-only data.
