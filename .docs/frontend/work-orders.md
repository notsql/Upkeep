# Work orders (ID-36, independent ID-38 and ID-40)

API: [work-orders.md](../api/work-orders.md). Generated request/response types
come from `@proj/api/schema`; feature hooks live in `src/lib/work-orders.ts`.

## Routes and screens

All route paths are beneath `src/routes/_auth/estates/$estateId/work-orders/`:

| Folder | URL | Screen |
| --- | --- | --- |
| index.tsx; -components/work-order-list-page.tsx; -components/work-order-filters.tsx | /estates/$estateId/work-orders | Status/category/priority/reference filters, paginated list and conditional Create |
| new/index.tsx; new/-components/ | /estates/$estateId/work-orders/new | Creation form; optional validated sourceReportId UUID search |
| $workOrderId/index.tsx; $workOrderId/-components/ | /estates/$estateId/work-orders/$workOrderId | Saved detail, progress, audit and completion |

Screens use PageHeader and named breadcrumbs, FormActions, shadcn Field,
Textarea, Input, Select, Button, Table, Badge, Card, Dialog, Alert and Empty.
Linked asset is one button showing the selected asset name/reference or No linked
asset. It opens a shadcn Dialog containing search by name/reference, result
buttons, loading/empty/error feedback and pagination. Search is not a work-order
field. Selected assets survive searches and can be removed. The detail footer
shows the creator display name and creation time; unavailable names use Name
unavailable instead of exposing the account ID.

List/create/detail breadcrumbs include Estates → estate name → Work orders.
The estate name links to `/estates/$estateId` only with `canViewManagement`;
Crew retain an unlinked label because the overview requires management access.

The list's shadcn Select offers All priorities, Low, Medium, High and Urgent.
Search reference accepts a partial visible reference, such as MG-W0001 (max 200
characters). Apply filters trims the search and updates URL `priority`/`q`,
resetting `cursor`; Clear filters resets all criteria/cursor and the controls. Pagination
preserves criteria. Refresh and browser history restore the applied values.
The route rejects invalid priorities and overlong/non-string searches before
mounting list queries. Filters combine on the server before pagination. Empty
filtered results say No matching work orders; an empty unfiltered estate says
No work orders yet. Status/category filters share the same URL/pagination rules.

Route-local components split source selection, optional asset search, location
feedback and save errors. The existing ReportFilters is reused outside the
creation form, so its filter form is never nested inside another form.
`new/-components/work-order-form.tsx` composes the creation screen;
`use-work-order-form.ts` owns its state, prefill, source-conflict choices and
submission guard. `work-order-source-fields.tsx` renders the source selector,
report picker and manual source reference. These share the existing feature
hooks and generated request type; the refactor adds no endpoint or query key.

The auth route checks work-order capabilities before the generic management
guard. Crew can enter list/detail, and cannot enter new. AppNavigation exposes
Work orders locally or as an entry to an authorized estate. WorkOrderEstateSwitcher
uses labels, estate-local roles and capabilities from access context. It includes
all membership estates and retains the work-order list when permitted in the
chosen estate; otherwise it opens that estate's allowed management, Crew or
resident destination. Crew do not request management estate lists. The trigger
uses the normal building icon, estate name and chevrons, without an additional
Work-order estate label. Outside an authorized estate, the global Work orders
button opens the shared EstateFeatureChooser, a shadcn Dialog that asks the user to choose
an estate. It never silently opens the first permitted estate. The same chooser
is available from mobile overflow, and filters choices using canViewWorkOrders.
Crew details render returned asset reference/location, linking assets only with
canViewAssets and source reports only with canViewFaultReports.

The existing estate-report detail screen adds Create work order only when both
creation and report-read capabilities are present. It passes sourceReportId to
the new route. The form reuses useEstateReport/useEstateReportList and active
location reads. The Resident report selector opens ReportSourcePicker's shadcn
Dialog with existing block/range filters, report buttons and cursor pagination.
Only the selected title stays on the main form; searching/paging does not discard
selection. Report-detail conversion resolves the preselected title.
Its shared report filter comboboxes use the same rounded 44px controls as the
estate report list; see [estate-reports.md](estate-reports.md).
Previously converted reports remain selectable. Description and location prefill
once per selected report; background refresh does not overwrite edits.
A placement conflict offers Reload source, then displays the updated source and
current work locations. Save stays disabled until Use updated report location or
Keep work location is chosen. Edited descriptions remain intact. A linked asset
at a different location must be removed before using the updated report location.

Equipment links are optional for all categories. Asset search uses only the
limited work-order asset endpoint, including for non-owner Managers. Selection
uses the asset's registered location and requires Use asset location confirmation
if changing an existing work location. Location is disabled while linked and
unlocked by Remove linked asset. The API enforces exact location equality. Empty
registers permit creation. Category SAFETY selects and locks URGENT priority.
Inspection/recommendation sources collect a required manual reference/explanation.
An empty active location list blocks saving and links to location management.
Save is disabled while pending, with an immediate in-flight guard. Mutations
never automatically retry. Errors retain inputs and link to the work-order list
so users can check after an ambiguous network response.

## Queries and mutations

All private work-order keys start with the current user ID:

- [userId, "work-orders", estateId, "list", { priority, q, status, category, sortBy?, direction? }, cursor]
- [userId, "work-orders", estateId, "detail", workOrderId]
- [userId, "work-order-assets", estateId, q, cursor]

List/detail use GET work-orders and GET work-orders/{workOrderId}; asset
options use GET work-order-assets. Queries require mounted identity and current
capabilities, pass cancellation signals, throw returned API errors and disable
automatic retries. List/detail refetch on focus. Authorization failures refresh
[userId, "app-access"]. Pages hide cached content on failed refetch or revoked
capability. Existing session cleanup cancels/removes previous-user caches.

POST work-orders uses the generated CreateWorkOrderRequest. Success seeds the
detail cache and invalidates only that user's estate work-order lists. Reports
and their picker eligibility do not change, so creation does not invalidate
report queries, asset history, dashboard totals or costs.

Source selection keeps existing [userId, "estate-reports", estateId, ...] keys.
Location reads reuse existing location keys. No owner-only asset list/detail
queries are needed to create or read an order as a Manager/Crew member.

Assignment/routing/provider filtering, attachments and saved inspection integration
belong to follow-up stories.


## Manual review

1. Run pnpm dev and open an estate's Work orders link as its owner or Manager.
   Create an Equipment fault with a description and location, leaving the asset
   empty. Verify the saved reference, OPEN status and list/detail entry.
2. Choose Safety and confirm priority becomes Urgent. Try Inspection and enter
   a manual source explanation; no saved inspection record is required.
3. From a fault report, choose Create work order. Edit the prefills and save.
   Create another order from that same report; references should differ and the
   report itself should be unchanged.
4. Use a Crew account to read and switch authorized estate work-order lists.
   Create should be hidden and direct /new access denied. Non-owner Managers
   can link an active asset without gaining access to the asset register.
5. As an owner/Manager, use the estate-name breadcrumb from list, create and
   detail to return to the overview. Crew should see the name without a link.
6. Apply a priority and partial reference search together. Check Next/First page,
   refresh and browser back retain criteria; Clear filters restores all results.
   A nonexistent reference should say No matching work orders.

Automated verification: 871 Java tests, 527 web tests, workspace type checks,
formatting and the production web build passed on 2026-10-23. The full test run
used a clean Java build and disabled Nx caching to avoid stale compiled tests.

To find an existing report, use Estate → Fault reports → open a report → Create
work order. Alternatively choose Source → Resident report in the creation form.
Both require current Manager responder membership and work-order creation
permission; estate ownership alone may not grant report access. Reports must
first be submitted by a resident assigned to that estate through Report a fault.
Existing owners receive their MANAGER membership through the owner backfill
migration documented in [access.md](../api/access.md).

Work orders uses the Wrench navigation icon; fault reports/Respond to faults use
ClipboardList. Global chooser buttons explicitly match sidebar-link alignment,
height, padding and spacing so shadcn Button defaults cannot center them.
EstateFeatureSwitcher is shared by WorkOrderEstateSwitcher and
ReportEstateSwitcher. EstateFeatureChooser handles both global destinations,
filtering by their existing independent capabilities and routing to the chosen
feature list. Neither entry picks the first estate automatically.

## Column sorting

The list's `-components/work-order-table.tsx` renders sortable Reference,
Category, Priority and Created headers using shared
`components/sortable-table-head.tsx` (shadcn Button/TableHead with direction
icons, keyboard interaction and aria-sort). First selecting Priority/Created
uses descending order; Reference/Category use ascending. Clicking again reverses.
Default is Created descending. Description and Status stay static.

The route validates URL `sortBy`/`direction`, derived from the generated API query
types. Sorting clears only `cursor`, keeps filters, and queries the complete
sorted result through the API. Priority ties use newest creation first, then ID descending, regardless of the
priority direction. Next/First page preserve ordering. Applying or
clearing filters preserves ordering; refresh/back restore it. An explicit
priority filter still narrows rows; sorting alone never removes a priority.
Sort navigation preserves the current scroll position. During a sort-only
reload, the existing table remains mounted and aria-busy to prevent page-height
collapse; pagination is disabled until the new results arrive. Placeholder rows
are limited to the same authorized user/estate and unchanged filters. They are
not carried across identity/estate changes, failures or revoked access. Filter
and pagination navigation retain normal scroll-reset behavior.

Linked asset and View source report links use persistent underlines, theme colours
and visible keyboard focus when their independent read capabilities permit links.
Signed-in unauthorized work-order URLs show Page not found before any generic
workspace/resident redirect; signed-out requests still go to sign-in.

The estate switcher includes all membership estates with estate-local roles,
even with one choice. Work-order/report context is retained where permitted;
otherwise selection opens management overview, Crew work orders or resident
reporting with estateId preselected. See [shell.md](shell.md). Conflict errors use
structured rounded shadcn Alerts; network advice is reserved for ambiguous errors.

ID-36 baseline manual-review verification: 555 web tests and 877 backend tests pass,
workspace type checks and the production web build pass, and web formatting/lint
passes. Java Spotless initially lacked dependencies in this PC's offline Maven
cache; an offline server:lint recheck on 2026-10-24 passed for 255 Java files.
Java formatting is verified. No dependency installation or database migration
was performed by the agent for these refinements.

## Progress and completion

Access context supplies canUpdateWorkOrders separately from creation/asset
capabilities. Detail adds route-local `work-order-progress.tsx`: active owners/
Managers see Start work on Open/Assigned and Complete work order on In Progress.
Crew see history/outcomes without mutation actions. Active owners/Managers see
Edit outcome on Closed work.

The completion shadcn Dialog scrolls within the viewport, uses labelled
Textarea/Input fields, explains SGD/whole minutes and unknown versus explicit 0,
and explains that closure retains Closed status while authorized users can correct
the recorded outcome. Findings/work performed are required.
Failed saves retain entered values. The version the user reviewed is retained;
background refetch cannot silently authorize a new version. Conflicts offer
Refresh work order and explicit review before retrying. Refresh after an ambiguous
response lets the user check whether the first request saved. No mutation retries
automatically. `components/work-order-completion.tsx` renders read-only outcomes
on both work-order detail and asset maintenance; unknown values stay Unknown.

Status history shows chronological transitions, actor display name (or Name
unavailable) and server date/time; raw account IDs are not display labels. Legacy
creation is derived by the API. Failed history loads offer Retry history.

New hooks in `lib/work-orders.ts` use generated types and endpoints:

- useWorkOrderStatusHistory: GET status-history;
  [userId, "work-orders", estateId, "history", workOrderId].
- useChangeWorkOrderStatus: PATCH status; useSaveWorkOrderCompletion: PUT completion.
  Both seed detail and invalidate that user's estate lists and order history.
- useAssetWorkOrderCompletions: GET asset work-order-completions;
  [userId, "asset-work-order-completions", estateId, assetId], gated by canViewAssets.
  Closure invalidates this key for a linked asset. Forecast/condition/manual-event
  queries are not invalidated because closure does not alter those records.

List query keys now include status/category with the existing criteria. Apply/
clear reset the cursor while preserving sort; the route validates the new enums.
Sort placeholder rows require unchanged status/category as well as priority/q.
Provider selection remains deferred until real ID-37 data is available; ID-38's
full acceptance is still pending that integration.

Manual review for the new progress/completion scope, after backend generation
and automated verification finish:

1. As an active owner/Manager, open an Open order and choose Start work. Confirm
   In Progress, a changed version and one actor/time history entry. Refresh and
   confirm the state persists. An older tab's start request should conflict and
   offer Refresh rather than overwrite.
2. Choose Complete work order. Leave findings/work performed blank and verify
   submission is blocked. Enter both; leave labour unknown, enter parts cost 0
   and downtime 0. Save once. Confirm Closed, unknown labour/total, zero parts/
   downtime and recorded closer/time after refresh. Edit outcome should prefill the
   saved values, require a correction reason and preserve Closed/original closure.
   Check the before/after audit and that asset Maintenance still has one entry.
3. Complete an asset-linked job. As its owner, open Maintenance: the reference,
   saved work location and outcome should appear once beside manual events.
   Move/retire an asset after starting another job; completing existing work
   should retain its original work location and asset link.
4. Use a non-owner Manager: start/close succeeds through work orders, while
   opening owner-only asset details/history remains denied. As Crew, read the
   outcome/audit without Start/Complete controls. Inactive estates stay read-only.
5. Combine status, category, priority and partial reference filters. Apply/clear
   should reset pagination and retain sorting; refresh/back restore criteria.
   Closed orders remain visible when status is omitted.
6. With a source-report job, compare the report and asset condition before/after
   closure. Their values and manual maintenance/forecast inputs should remain
   unchanged. In browser device emulation, check dialog scrolling, keyboard
   focus, narrow portrait/landscape and light/dark themes.

Verification on 2026-10-24 for progress/completion: 564 web tests and 913 backend
tests pass; workspace types, formatting/lint and the production web build pass.
The actual detail/filter/dialog components were clicked through in isolated
Chrome with fixture hooks at 320×740, dark 390×844 and landscape 844×390. Dialog
bounds, landscape footer scrolling, required fields, keyboard tab order and
zero/unknown outcome display passed without horizontal overflow. These checks
do not replace live authenticated manual QA or physical-device testing. All
fixture/browser driver files and screenshots are outside the repository.

Live authenticated review on 2026-10-24 also exercised Manager creation/start/
closure, stale-tab conflict detection, retained input after failed saves, and an
identical retry after a deliberately lost successful completion response. The
retry returned the existing completion without duplicate audit or maintenance
entries. Owner asset history showed the saved work location and 17.00 SGD total
after its linked QA asset was moved and retired. Crew remained read-only and
non-owner Managers could close work without owner-only asset access. Resident
estate work-order list/create URLs showed Page not found. Combined filters,
refresh/back and live narrow portrait/dark layouts passed. The live 844×390
completion dialog fit within the viewport and scrolled to Cancel/Complete.

The earlier review found a recovery defect: Refresh work order refreshes detail/status/actions
but leaves status history stale, and the resolved conflict warning remains.
New Created events could also display Name unavailable despite an available
creator name. Both are addressed by the agreed
[follow-up implementation](../../.spec/features/work-order-review-follow-ups.md),
along with oldest-first priority ties and audited outcome corrections.

QA records left in shared development: TS-003-W0003 and TS-003-W0004 (Closed),
BRO-123-W0001 (Closed), and retired asset BRO-123-A0001 under QA Progress Block / QA Service
Area. They were created for live persistence/lifecycle checks. Follow-up QA
corrected the two earlier QA outcomes and created/closed TS-003-W0004 to verify
refreshed history and lost-response recovery. No existing non-QA work or estate
member permissions were changed. Physical-phone testing, a live page containing
more than 20 matching orders, and live inactive-estate coverage remain unverified;
pagination and inactive-estate rules have automated coverage.


## Review follow-ups: recovery, corrections and pagination

Refresh work order reloads the detail and status history together, and correction
history for a completed order. Its shadcn Alert has a title, separated/wrapping
actions and a pending button. A resolved warning clears only after reads succeed.
Transient network/5xx refresh failures retain the last loaded detail and dialog
draft with feedback; denied/unavailable records and revoked access hide content.
Failed saves retain all entered values. Refresh never silently adopts a new
expectedVersion: the user explicitly reviews the current outcome before retrying.

Edit outcome reuses the labelled completion fields, prefilled from the outcome
captured when the dialog opens. Blank optional values send explicit null, costs
remain decimal strings, and downtime 0 remains zero. Correction reason is required
(max 500); mutations use the generated CorrectWorkOrderCompletionRequest. A save
keeps the job Closed and preserves its original closer/time. CompletionOutcome
shows Edited author/time in both detail and Maintenance. The Outcome corrections
card loads revisions with reason/actor/time and a keyboard-accessible View before
and after button exposing both saved snapshots. Crew can read this audit.

Hooks in `lib/work-orders.ts`:

- useWorkOrderCompletionRevisions: GET completion-revisions; key
  [userId, "work-orders", estateId, "revisions", workOrderId], enabled for an
  accessible completed order; retries are explicit.
- useCorrectWorkOrderCompletion: PATCH completion; requires canUpdateWorkOrders,
  has no automatic retries, seeds detail and invalidates the list, status/revision
  history and linked owner's asset-work-order-completions cache. It does not
  invalidate or write forecast/manual-event data.

The work-order footer displays the current page's row count and Next/First page.
Previous returns to cursors visited in the current list session. That cursor
trail is scoped to user, estate and criteria; applying/clearing filters or sorting
resets it. A directly opened later cursor has First page without an invented
previous cursor, total or page number. Requests stay server-paginated at 20 rows;
buttons disable while sort placeholder rows are visible. Priority ties are now
oldest first in both priority directions, then stable descending IDs. Created
sorting still defaults newest first.


Follow-up verification on 2026-10-24: 936 backend tests and 575 web tests pass,
with workspace types, pnpm fix/check and the production web build. Live owner/
Manager correction, stale-tab review, updated before/after audit and Crew read-only
screens passed. Refresh cleared the stale start warning and fetched its missing
history entry. A lost successful completion response followed by Refresh showed
Closed without switching the dialog into editing mode. Priority sorting placed
older equal-priority jobs first. Existing QA asset Maintenance still displayed
one entry after correction. Dark 320px portrait and light 844×390 landscape edit
dialogs fit and scroll to their action buttons; Tab advances Findings → Work
performed. The member table stays within the page at 320px with its own horizontal
scroll. Physical-phone and large live datasets remain the limits noted above.

Document attachment section and its independent document permission guard:
[work-order-documents.md](work-order-documents.md). Authenticated downloads reuse
ID-22; association changes preserve job status, outcomes and maintenance costs.
