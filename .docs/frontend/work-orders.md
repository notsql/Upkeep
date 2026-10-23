# Work orders (ID-36)

API: [work-orders.md](../api/work-orders.md). Generated request/response types
come from `@proj/api/schema`; feature hooks live in `src/lib/work-orders.ts`.

## Routes and screens

All route paths are beneath `src/routes/_auth/estates/$estateId/work-orders/`:

| Folder | URL | Screen |
| --- | --- | --- |
| index.tsx; -components/work-order-list-page.tsx; -components/work-order-filters.tsx | /estates/$estateId/work-orders | Priority/reference filters, paginated list and conditional Create |
| new/index.tsx; new/-components/ | /estates/$estateId/work-orders/new | Creation form; optional validated sourceReportId UUID search |
| $workOrderId/index.tsx; $workOrderId/-components/ | /estates/$estateId/work-orders/$workOrderId | Saved read-only detail |

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
resetting `cursor`; Clear filters resets all three and the controls. Pagination
preserves criteria. Refresh and browser history restore the applied values.
The route rejects invalid priorities and overlong/non-string searches before
mounting list queries. Filters combine on the server before pagination. Empty
filtered results say No matching work orders; an empty unfiltered estate says
No work orders yet. All current orders are OPEN; status filtering awaits ID-38.

Route-local components split source selection, optional asset search, location
feedback and save errors. The existing ReportFilters is reused outside the
creation form, so its filter form is never nested inside another form.

The auth route checks work-order capabilities before the generic management
guard. Crew can enter list/detail, and cannot enter new. AppNavigation exposes
Work orders locally or as an entry to an authorized estate. WorkOrderEstateSwitcher
uses labels and canViewWorkOrders from access context; switches open the estate's
work-order list and do not request management estate lists for Crew. The trigger
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
location reads; report selection retains existing filters and pagination.
Previously converted reports remain selectable. Description and location prefill
once per selected report; background refresh does not overwrite edits.
A placement conflict offers Reload source, updates the observed placement and
preserves edited description/work location.

Equipment links are optional for all categories. Asset search uses only the
limited work-order asset endpoint, including for non-owner Managers. Empty
registers permit creation. Category SAFETY selects and locks URGENT priority.
Inspection/recommendation sources collect a required manual reference/explanation.
An empty active location list blocks saving and links to location management.
Save is disabled while pending, with an immediate in-flight guard. Mutations
never automatically retry. Errors retain inputs and link to the work-order list
so users can check after an ambiguous network response.

## Queries and mutations

All private work-order keys start with the current user ID:

- [userId, "work-orders", estateId, "list", { priority, q, sortBy?, direction? }, cursor]
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

Assignment/routing, status transitions, advanced filters, costs, attachments and
saved inspection integration belong to follow-up stories.


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
Default is Created descending. Description and OPEN-only Status stay static.

The route validates URL `sortBy`/`direction`, derived from the generated API query
types. Sorting clears only `cursor`, keeps filters, and queries the complete
sorted result through the API. Next/First page preserve ordering. Applying or
clearing filters preserves ordering; refresh/back restore it. An explicit
priority filter still narrows rows; sorting alone never removes a priority.
Sort navigation preserves the current scroll position. During a sort-only
reload, the existing table remains mounted and aria-busy to prevent page-height
collapse; pagination is disabled until the new results arrive. Placeholder rows
are limited to the same authorized user/estate and unchanged filters. They are
not carried across identity/estate changes, failures or revoked access. Filter
and pagination navigation retain normal scroll-reset behavior.
