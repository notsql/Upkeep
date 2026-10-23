# Create a work order

**Status:** implemented 2026-10-22; ready for manual review
**Owner:** Chan Ding Jie
**Jira:** [ID-36](https://notjira.atlassian.net/browse/ID-36), under
[ID-2 — Work Orders and Contractor Routing](https://notjira.atlassian.net/browse/ID-2)

## Problem

Owners can register assets and residents can submit fault reports, but there
is no work-order record, API or screen. A reported problem cannot yet become
identifiable work that subsequent stories can route, track and close.

## Existing system and proposed scope

Reassessed on 2026-10-21 against `main` at `9aabb95`, after
[PR #31](https://github.com/notsql/Upkeep/pull/31), and our fix commit `c17d708`
on `feat/create-work-order`. PR #31 remains the latest merged PR at this review;
[PR #32](https://github.com/notsql/Upkeep/pull/32) is open. The original draft
predated the estate-role and fault-report changes. Permissions, optional asset
links, multiple orders per report, manual inspection/recommendation source
references, priority levels and reference format were agreed on 2026-10-22.
The agreed scope is implemented below, including the 2026-10-23 priority/reference filter, breadcrumb and column-sorting refinements. Verification passed: 871 Java tests, 527 web tests, workspace type checks, formatting and the production web build. The additive migration is applied to the configured development database.

- `Estate`, `Location`, `Asset` and `IssueReport` already exist. There is no
  `WorkOrder`, inspection record or persisted maintenance-recommendation model.
- Estate roles now include MANAGER and CREW. Estate detail editing and location
  creation permit owners or assigned Managers, while asset operations remain
  owner-only. Owners and assigned Managers create work orders; they and Crew
  can view all work orders in their authorized estate. Keep the proposed limited
  work-order asset picker separate from broader asset management.
- Estate report lists, details, private images and location correction already
  exist at `/estates/{estateId}/reports`. They require explicit MANAGER/CREW
  membership; ownership alone is insufficient. Reuse these APIs, generated DTOs,
  hooks in `lib/estate-reports.ts` and existing report screens. Drop the original
  proposed `/reported-issues` endpoint and duplicate report-source DTOs.
- `/resident/reports` remains submitter-only. Residents can now belong to several
  estates; creation uses the route estate and validates every related ID against
  it, never a singleton resident context or a global WorkOS role claim.
- Deliver manual creation for all source types and a linked conversion path for
  existing resident reports. Inspections and maintenance recommendations use a
  manually entered source reference/explanation for the first version. Direct
  links to saved inspection/recommendation records are deferred until those
  records exist; ID-36 does not build those source systems.
- Include a basic paginated work-order list and read-only details so a saved
  order remains reachable after refresh. Priority/reference filters were added
  during review on 2026-10-23. Workflow/status filters and updates belong to ID-38.

## Review against Jira, merged work and our fixes

Jira [ID-36](https://notjira.atlassian.net/browse/ID-36) still requires description,
location, category, priority and source; a relevant asset link; a unique reference;
initial Open status; authorized estate access; and manual creation without AI.
The agreed business choices and planned implementation below refine those requirements.

| Reviewed area | Effect on this plan |
| --- | --- |
| PR #31 estate-local roles and ownership transfer | Owners/current Managers create work orders; owners/current Managers/Crew read all orders in their authorized estate. Check current estate membership, including after a write lock wait. Provider-admin claims and another estate's role grant no authority. |
| PR #31 Manager/Crew reports, private images and location correction | Reuse the existing report APIs, hooks and shared report components. Add a conversion entry point to the existing detail page. Keep report-read authority separate from work-order creation, including legacy owners without responder membership. |
| PR #31 owner-only assets | Keep the proposed limited work-order asset picker for non-owner Managers. Do not use the asset list/detail API or widen asset-management permissions just to populate the form. |
| Our Manager monitoring and dashboard fixes | These restore their own feature permissions/counts; they do not grant work-order access. Add explicit work-order capabilities. Include assigned non-owner Managers in permission tests. |
| Our forecast-refresh fix | Preserve the existing assessment-to-forecast invalidation. Forecasts are derived reads, not persisted recommendation records or recommendation IDs that a work order can reference. |
| Our floor-preview fix | Reuse the existing location hierarchy and bounded floor preview if the user needs to create locations. Work-order creation selects a location ID; it does not need a new floor-generation form or endpoint. |
| Inspection and recommendation sources | Agreed first version: choose the source and manually enter a reference/explanation, with an optional existing asset link. No inspection or persisted recommendation model exists to link. Direct saved-record integration is deferred. |
| Neighboring Jira stories | Assignment/category routing remains ID-37; workflow changes, status filters and status history remain ID-38; closure/cost/history writes remain ID-40; invoice/service-report association remains ID-26. ID-36 creates an Open order and provides list/detail reads with priority/reference filtering agreed during review. |

### Agreed decisions — 2026-10-22

| Current authority in the requested estate | Create | List and view details |
| --- | --- | --- |
| Owner, without a conflicting RESIDENT membership | Yes, in an active estate | All work orders in that estate |
| Assigned MANAGER | Yes, in an active estate | All work orders in that estate |
| Assigned CREW | No | All work orders in that estate |
| COUNCIL, MEMBER, RESIDENT or unassigned account without ownership | No | No |

Crew viewing is estate-wide, not limited to assigned jobs. It does not depend
on the future assignment system. Work-order status updates and completion
permissions remain separate decisions for ID-38 and ID-40. Existing report and
asset permissions are unchanged.

Asset linking is optional for every category, including equipment faults.
Missing or unregistered equipment must not block work-order creation: description
and location still identify the work. When supplied, an asset must be active and
belong to the same estate. An unlinked order has no associated asset history;
adding a link after creation is outside ID-36's current scope. The limited picker
for owners/Managers remains the proposed implementation for selecting an asset.

A resident report may produce multiple work orders, for example a plumbing
repair and a separate cleanup. Each order has its own reference, category,
priority and status, while retaining the same source-report link. Previously
used reports remain selectable. No uniqueness constraint limits orders per
report. Preventing accidental double submission is separate: disable Save while
saving, do not automatically retry creation, and let the user check the list
after an ambiguous response. This does not promise server-side request idempotency.

For the first version, inspection and maintenance-recommendation sources use a
manually entered reference/explanation. For example, choose Inspection and enter
"Routine inspection — pump seal leaking". No saved inspection/finding or
recommendation ID is required. The same form records the location, description
and optional asset. Resident-report sources still link to actual saved reports.
Work-order creation does not require inference. Direct inspection integration
is an explicit later follow-up once the inspection feature is ready: a creator
can select a saved inspection/finding or raise an order from that finding while
retaining its record link. Its record contract and permissions will be agreed
with the inspection feature. Existing manually recorded source explanations must
remain readable. No inspection tables or placeholder inspection IDs are added
for ID-36. Saved recommendation integration is likewise deferred until records exist.

Agreed priorities are Low, Medium, High and Urgent (`LOW`, `MEDIUM`, `HIGH`,
`URGENT`). Safety orders always use Urgent, the highest level required by the
parent epic. Work categories remain Equipment fault, Cleanliness and Safety,
as required by the epic.

References use `<ESTATE CODE>-W<sequence>`, for example `MG-W0001`, `MG-W0002`.
The server assigns a sequence within each estate, with at least four digits
and no reset when the estate code changes. The number can grow beyond 9999.
Existing work-order references are immutable when the estate code changes.

### Decision status

The current business decisions are agreed. Direct inspection integration remains
a later follow-up; assignment, progress updates and closure remain their own stories.

### Readiness and suggested sequence

1. Business decisions above were agreed on 2026-10-22. Start implementation with
   observable acceptance tests for the agreed manual-creation path.
2. Resolve the failed CI check on PR #32 before merging it. The reviewed
   [CI run](https://github.com/notsql/Upkeep/actions/runs/39620457840/job/119292206700)
   ran 825 backend tests and failed
   `RoleInvitationsIntegrationTests.residentsCanAcceptIntoMultipleEstatesWithoutLosingEarlierMemberships`:
   expected 2 memberships, counted 4. The assertion counts all rows for a shared
   `recipient` fixture user, so test isolation is a hypothesis to reproduce, not
   a confirmed application defect. This planning review changes no test or code.
3. Build the manual path first through TDD: owner/Manager authority, active
   location, optional asset under the agreed rule, unique reference and Open
   status, then its generated API contract and create/list/detail UI. The feature
   branch already contains the fixes; update it against the merged base before
   publishing the feature PR.
4. Add resident-report conversion using the existing report APIs/screens,
   including source-location conflict handling and multiple independent work
   orders linked to the same report.
5. Add the agreed manual inspection/recommendation provenance fields, then
   verify all source paths still work with inference unavailable. Preserve the
   existing monitoring, dashboard, forecast and floor-preview regressions.

## Behaviour

Permissions, optional asset links, multiple orders per report, manual source
references, priorities and reference format were agreed on 2026-10-22. Every
numbered rule must be covered by an observable test.

1. An authenticated owner or assigned MANAGER can create a work order in an
   active estate. Reuse the current `EstateRepository.isManager` policy, which
   includes ownership and excludes target-estate residents. Assigned CREW can
   read all work orders in their estate but cannot create them. Derive explicit
   `canViewWorkOrders` (owner/Manager/Crew) and `canCreateWorkOrders`
   (owner/Manager in an active estate) capabilities in the existing access
   projection, rather than treating `canViewFaultReports` as write access.
   A target-estate RESIDENT membership denies management access even if the
   account also owns it. Provider-admin claims grant no estate authority. Check
   current membership again after acquiring the estate write lock.
2. Creation records a trimmed description (1–2,500 characters), an active
   location in the same estate, category, priority and source. Reject blank
   descriptions, invalid UUIDs, unknown enum values and overlong input.
3. Categories are `EQUIPMENT_FAULT`, `CLEANLINESS` and `SAFETY`; these are work
   categories, separate from the existing equipment catalogue. Agreed
   priorities are `LOW`, `MEDIUM`, `HIGH` and `URGENT`. Safety orders must use
   `URGENT`, following the parent epic's highest-priority requirement. The form
   selects it automatically; the server rejects a lower value.
4. Agreed: `assetId` is optional for every category, including equipment faults.
   A supplied asset must be active and
   belong to the same estate. Default its location into the form, but allow an
   explicitly chosen work location elsewhere within that estate. A dedicated
   read returns only active asset identifiers, references, names and locations
   to authorized work-order creators, including non-owner Managers. It grants no
   asset-detail, history, cost, sensor or asset-write access.
5. Sources are `MANUAL`, `RESIDENT_REPORT`, `INSPECTION` and
   `MAINTENANCE_RECOMMENDATION`. Agreed first version: inspection/recommendation
   creation uses a manually entered, trimmed source reference or explanation
   (1–500 characters), without a saved inspection/recommendation ID. Manual
   creation requires neither an external record nor an AI result.
6. A resident-report source requires `sourceReportId` in the same estate and
   existing responder authority as well as work-order creation permission. An
   owner without a MANAGER/CREW membership can create manually but cannot read or
   convert reports. Existing report screens and the form's selector prefill the
   description and current location; these can be edited before creation.
   Persist the report link even when copied text or work location changes.
   Other source types reject `sourceReportId`. Creating an order never relocates
   or otherwise updates the source report.
7. Agreed: multiple work orders can originate from the same resident report.
   Each valid creation produces a distinct reference and independent job while
   preserving `sourceReportId`. Prior use of that report does not cause 409 or
   remove it from the picker. Concurrent valid creations from the same report
   may both succeed; each must still pass current access and location checks.
8. The server assigns an immutable reference in the agreed format `<ESTATE CODE>-W0001`,
   unique within the estate, initial status `OPEN`, creator subject and creation
   timestamps. Clients cannot supply the reference, status or creator. Changing
   an estate code does not rewrite earlier references.
9. Authorized owners, Managers and Crew can list and open every work order in
   that estate, without an assignment filter,
   including after estate deactivation or linked asset retirement. Current
   membership is checked on each request. Manager demotion to Crew retains reads
   and revokes creation; Crew removal or demotion to Council/Member/Resident
   revokes reads without requiring a new token. Creation is disabled for an
   inactive estate. Unknown/foreign records return 404, without exposing data.
10. Reuse the existing authorized estate-report responses, including their
    private image reads; do not copy image bytes or storage keys into work
    orders. The source report and its images keep their independent access
    rules. Resident own-history/image endpoints remain submitter-only and the
    report's existing status is unchanged.
11. Saving shows confirmation and opens the new order's detail page. A failed
    request retains entered values and shows an accessible error. Save and
    Cancel are disabled while saving. Returning to the list shows the new order.
12. Creation works with inference unavailable: this path calls neither the ONNX
    model nor an external AI provider. Missing report-picker data does not block
    the independent Manual source path.
13. Report conversion supplies `expectedSourceLocationId`, the location last
    observed in the source detail. Under the shared estate lock, reject a changed
    source location with 409 and ask the user to reload. Check this even when a
    different work location was deliberately selected. Later report relocation
    does not move an already-created work order; its explicit location and source
    link remain intact.

## Data

Add `WorkOrder` to `packages/db/prisma/schema/schema.prisma`:

| Field | Proposed storage |
| --- | --- |
| `id` | UUID primary key |
| `estateId` | UUID, required relation to `Estate` |
| `reference` | Required varchar(70); unique `(estateId, reference)` |
| `description` | Required varchar(2500) |
| `locationId` | Required UUID; composite FK `(locationId, estateId)` to `Location` |
| `assetId` | Nullable UUID; composite FK `(assetId, estateId)` to `Asset` |
| `category`, `priority` | Required varchar(30), validated Java enums in DTOs |
| `source` | Required varchar(30), validated Java enum in DTOs |
| `sourceReportId` | Nullable UUID; composite FK `(sourceReportId, estateId)` to `IssueReport` |
| `sourceReference` | Nullable varchar(500), required for inspection/recommendation |
| `status` | Required varchar(20), default `OPEN` |
| `createdByUserId` | Required varchar(255), from authenticated subject |
| `createdAt`, `updatedAt` | Required timestamptz(6) |

Add the back-relations on `Estate`, `Location`, `Asset` and `IssueReport`, and
`IssueReport.@@unique([id, estateId])` for the composite report FK. This identifies
the report within its estate and does not limit how many orders reference it.
Do not make `WorkOrder.sourceReportId` or `(estateId, sourceReportId)` unique:
several work orders may reference the same report. Add `(estateId, createdAt, id)`
for stable list pagination. Use restrictive FK actions; no delete endpoint.

In one transaction, lock the estate row, then recheck current owner/Manager
authority and active state before checking its location, optional asset and
source and allocating the reference. For report conversion, also recheck current
responder membership and the observed source placement. Follow the existing
estate-before-membership ordering used by relocation and member changes; do not
reverse the invitation service's invitation-before-estate locking. Since work orders
cannot be deleted, a serialized per-estate count plus one can allocate the
numeric suffix, as existing asset creation does; retain the uniqueness
constraint. Concurrent asset retirement, estate/location deactivation and
report conversion must not leave an invalid or partial order. Concurrent valid
orders for the same report receive distinct references and retain their source links.

Retain the report pagination indexes added by PR #31; do not recreate them.
The work-order table and composite report key are still needed. Derive the two
new work-order capability booleans in `AppAccessResponse` without new role rows,
account migrations, bulk owner promotion or WorkOS role changes.

Use an additive Prisma migration, compatible with the running application.
Regenerate Prisma and jOOQ; never hand-edit generated Java database classes.
No provider, assignment, cost, attachment, status-history or escalation tables
are needed for this story.

## API

All new endpoints require an authenticated subject and current authority in the
target estate. Work-order list/detail reads permit owners, Managers and Crew;
creation and the asset picker require owners or Managers. Report conversion additionally uses existing
responder authority; never infer that from projected role text or ownership.
Register only the exact method/path pairs in
`SecurityConfig`; preserve its final deny-all rule. Require a real principal for
these endpoints even when JWT configuration is absent locally.

| Method | Path | Request | Success response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/work-orders` | `CreateWorkOrderRequest` | 201 `WorkOrderResponse`; `Location` points to detail API | Owner/Manager; active estate; responder check for report source |
| GET | `/estates/{estateId}/work-orders` | Optional `priority: WorkOrderPriority`, `q: string` (max 200), `cursor: string`, `limit: integer` (1–50; default 20) | 200 `WorkOrderPageResponse` | Owner/Manager/Crew; filtered orders in this estate |
| GET | `/estates/{estateId}/work-orders/{workOrderId}` | UUID paths | 200 `WorkOrderResponse` | Owner/Manager/Crew |
| GET | `/estates/{estateId}/work-order-assets` | Optional `q: string` (max 200), `cursor: string`, `limit: integer` (1–50; default 20) | 200 `WorkOrderAssetPageResponse` | Owner/Manager; active estate |
| GET (reuse existing) | `/estates/{estateId}/reports` | Existing hierarchy filters/cursor/limit; reports remain selectable after work-order creation | Existing `IssueReportPageResponse` | Existing MANAGER/CREW responder membership |
| GET (reuse existing) | `/estates/{estateId}/reports/{reportId}` | UUID paths | Existing `IssueReportDetailResponse` | Existing responder membership |
| GET (extend existing) | `/access/context` | None | Existing `AppAccessResponse`; estate entries gain `canViewWorkOrders: boolean`, `canCreateWorkOrders: boolean` | Existing authenticated subject |

Proposed DTOs:

- `CreateWorkOrderRequest`: `description: string`, `locationId: UUID`,
  `assetId?: UUID`, `category: WorkOrderCategory`, `priority: WorkOrderPriority`,
  `source: WorkOrderSource`, `sourceReportId?: UUID`, `sourceReference?: string`,
  `expectedSourceLocationId?: UUID` (required only for report conversion; reject
  it on other source types).
- `WorkOrderResponse`: `id: UUID`, `estateId: UUID`, `reference: string`,
  `description: string`, `locationId: UUID`, `locationPath: string`,
  `assetId: UUID | null`, `assetReference: string | null`,
  `category: WorkOrderCategory`, `priority: WorkOrderPriority`,
  `source: WorkOrderSource`, `sourceReportId: UUID | null`,
  `sourceReference: string | null`, `status: WorkOrderStatus` (`OPEN` initially),
  `createdByUserId: string`, `createdByName?: string` (current display name on create/detail), `createdAt: date-time`, `updatedAt: date-time`.
- `WorkOrderPageResponse`: `items: WorkOrderResponse[]`,
  `nextCursor: string | null`. Order newest first by `(createdAt, id)`.
- `WorkOrderAssetOptionResponse`: `id: UUID`, `reference: string`, `name: string`,
  `locationId: UUID`, `locationPath: string`.
- `WorkOrderAssetPageResponse`: `items: WorkOrderAssetOptionResponse[]`,
  `nextCursor: string | null`. Search literally by name/reference, order by
  `(reference, id)` and encode both in the cursor. Return only active assets
  whose location and ancestors are active in the requested estate.
- Reuse `IssueReportPageResponse` and `IssueReportDetailResponse` from the
  generated contract; no duplicate intake DTOs.

Errors use the existing `EstateError { message: string }` envelope: 400 for
validation/cursor errors; 401 missing/invalid identity; 403 known target-estate
members without the required capability (including resident conflicts and
owner-without-responder report conversion); 404 inaccessible/missing estates or
foreign/missing related records; 409 inactive estate/location/ancestor/asset or
changed source location. An existing work order from the same report is not a
conflict. Preserve existing report
endpoint status semantics. Personal data
responses use `Cache-Control: private, no-store`.

Implement real record DTOs and documented response codes in
`com.proj.server.workorder`, using jOOQ persistence and a transactional service.
Export with `pnpm api:generate`; the frontend imports the generated schemas.

Example creation body:

```json
{
  "description": "Water pooling beside the bin centre.",
  "locationId": "123e4567-e89b-42d3-a456-426614174000",
  "category": "CLEANLINESS",
  "priority": "MEDIUM",
  "source": "MANUAL"
}
```

## Frontend

Add directory routes under `apps/web/src/routes/_auth/estates/$estateId/`:

- `work-orders/index.tsx`: basic paginated list with reference, description,
  category, priority, status and creation time; links to detail and Create.
- `work-orders/new/index.tsx`: creation form and optional report selector.
- `work-orders/$workOrderId/index.tsx`: read-only saved work order.
- Route-local screens/components live beside their routes in `-components/`.

Link Work orders from the estate overview/navigation using `canViewWorkOrders`,
with Create controlled by `canCreateWorkOrders`. Add explicit work-order route
guards in `_auth/route.tsx`: owners/Managers/Crew can enter list/detail routes;
the `/new` route requires creation capability. Evaluate work-order read access
before the generic management-only guard so Crew is not rejected. Crew navigation
and estate selection use estate labels and work-order capabilities from access
context, without calling owner-only asset APIs or management estate details.
Crew can switch among estates where they can view work orders; each destination
opens that estate's work-order list. Reuse `PageHeader`, named breadcrumbs, `FormActions`,
the existing form layout and shadcn Field/Input/Textarea/Select/Combobox/Button,
Table/Badge/Alert/Empty. Reuse active location reads; use the limited work-order
asset hook for both owners and non-owner Managers. Do not call owner-only asset
detail/list hooks from a non-owner Manager's form. An empty asset register does
not block asset-free creation.

Crew detail pages render the work order's returned asset reference and location
without fetching owner-only asset details. Show links to assets or source
reports only when the reader has those independent capabilities. Hide Create
and report-conversion actions from Crew; direct creation URLs and POSTs remain
denied by the route guard and backend respectively.

Add Create work order on existing estate-report details only when the user has
both creation and report-read capabilities. Link to the new route with a
validated `sourceReportId` search parameter, using existing `useEstateReport`
to load authorized source data and its observed location. The creation form's
selector reuses `useEstateReportList` with its existing filters and query keys.
Keep reports selectable after prior conversions so a creator can raise another
job from the same source. No report-list filter or contract extension is needed.
Reuse shared report components if showing a source preview. This work neither
adds a new report list/detail screen nor changes Crew report access. Prefill once;
background refetches must not overwrite edits. A source-placement conflict needs
an explicit Reload source action while retaining edited text and work location.

Add `apps/web/src/lib/work-orders.ts` hooks around the generated client. New
private keys begin with the user ID: `[userId, "work-orders", estateId, ...]`
and `[userId, "work-order-assets", estateId, ...]`. Report selection keeps the
existing `[userId, "estate-reports", estateId, ...]` keys. Gate reads on session
readiness and current capabilities;
pass cancellation signals and throw client errors explicitly. On access failure
or revocation, hide cached content as report pages do and explicitly refresh
`[userId, "app-access"]` on authorization errors; the existing report query hooks
do not themselves perform that error-triggered refresh.
On successful creation, seed detail data and invalidate that user's estate
work-order list. Source reports and picker eligibility are unchanged, so their
queries need no creation-triggered invalidation. No dashboard, asset-history or
cost invalidation is needed yet.

## Edge cases

- Blank/oversized descriptions, malformed IDs, absent required source references,
  invalid enum values and inconsistent source/report combinations return 400.
- Empty source lists and no assets offer usable empty states. No active location
  blocks creation with a link to the existing location-management screen.
- Test creation without an asset for every category, including equipment faults
  when no equipment is registered. A supplied foreign or inactive asset still
  fails validation; optional linking does not relax its estate or active checks.
- A report's old location may have been deactivated: require selection of an
  active replacement work location while keeping the original report link.
- A report corrected after form load must return 409 on conversion. Share the
  estate lock with relocation; reload the source explicitly. Corrections after
  conversion leave work-order location unchanged. This is a separate record,
  not a new report correction workflow.
- Report/asset/location IDs from another estate must fail even when the caller
  owns both estates. Database composite FKs reinforce service checks.
- Parallel submissions receive distinct references, including multiple valid
  jobs from the same resident report. Verify both orders retain their report
  link and the report remains selectable. A failed transaction leaves no order behind.
- A creation POST is not automatically retried after an ambiguous network failure.
  Disabling Save prevents browser double submission; request idempotency for all
  manual orders is not claimed. Let the user check the list before retrying.
- Test creation racing with deactivation/retirement using real database
  transactions. Multiple valid jobs from one report do not trigger a uniqueness
  failure; stale source-location conflicts still return 409.
- Report membership changes do not move its estate or erase the source link.
  Existing report endpoints and conversion cannot read another estate's reports,
  even when the resident submitted in several estates.
- Test assigned non-owner Managers, legacy owners without MANAGER membership,
  CREW, Council, Member, Resident, unassigned subjects and provider-admin claims
  independently. Report authority, ownership and asset access are not equivalent.
  Ownership transfer preserves work-order access through retained Manager
  membership, while later Manager removal/demotion revokes it.
- Test Manager removal/demotion or responder revocation while creation waits
  for the estate lock. Recheck after the wait; no order may slip through.
- Test Crew list/detail reads for multiple jobs in the estate without any
  assignment record, inactive estate history, denial of creation/asset-picker
  access, foreign-estate isolation and immediate read revocation. Manager-to-Crew
  demotion preserves reads but denies creation. Crew-to-Council/Member/Resident
  demotion denies work-order reads.
- Inactive estates/retired assets remain readable through saved work orders.
  Reads never depend on the AI provider or report image storage being available.
- Failed loading/saving retains user input, announces errors and supports retry;
  direct unauthorized URLs expose no order or resident-report data.

## Out of scope

- Contractor/provider assignment and category routing (ID-37).
- Status transitions, status filtering and change history (ID-38).
- Escalation timers and notifications; enforce only safety's initial priority.
- Closure, labour/parts/cost/downtime and asset-history writes (ID-40).
- Invoice/service-report attachment (ID-26), new report-image access grants,
  resident progress synchronization and contractor self-service. Existing
  responder image reads remain available through their current endpoints.
- Automatic AI creation, model execution, a new inspection subsystem or a new
  persisted recommendation subsystem.
- Direct links to saved inspection/finding records and a Create work order
  entry point on an inspection screen: follow-up after the inspection feature
  exists. ID-36 records the source manually in the meantime.
- Editing/deleting work orders, generic workflow engines or new dependencies.
- Broadening existing asset APIs, bulk account/role migration, restoring global
  admin endpoints or rewriting the merged invitation/report workflows.

## Implementation phases

- [x] **Agree this spec.** Permissions, optional asset links, multiple orders
  per report, manual source references, priorities and reference format were
  reviewed and agreed on 2026-10-22. Record the agreed reference, source-link
  and permission decisions in `.spec/decisions/` during implementation.
- [ ] **Start the TDD loop.** Write and run a failing creation/validation test
  before production code. Add the proposed request rules with plain JUnit tests;
  then add HTTP/security and persistence tests before their implementations.
- [ ] **Add persistence.** Create the additive Prisma migration, regenerate via
  `pnpm db:generate`, and compile through the existing Nx server target. Verify
  composite FKs, reference allocation, multiple jobs per report and rollback
  against migrated disposable Postgres, including concurrency cases.
- [ ] **Implement the API test-first.** Thin controller, service/repository, exact
  security matchers, capabilities, limited asset picker, DTO validation and error
  mapping. Reuse estate-report authorization and the existing report list
  unchanged. Test owner/Manager/Crew/resident/member/
  council/unassigned/provider-admin callers, revocation and transfer, cross-estate
  IDs, list/detail retrieval, source-location races and creation without inference.
- [ ] **Regenerate the contract.** Run `pnpm api:generate` against the configured
  development environment. Keep both generated contract files with the change;
  never hand-write the frontend request/response types.
- [ ] **Build the screens test-first.** Use Vitest/Testing Library in
  `apps/web/tests/`, mirroring source paths, and `renderWithProviders`. Observe
  failures for manual asset-free creation, optional asset selection, report
  prefill/linking from existing report details, Manager asset selection, stale
  source reload, invalid forms, loading/errors, pending Save, success navigation,
  list/detail retrieval, Crew estate-wide reads with creation denied, and
  permission boundaries before implementation.
- [ ] **Document and verify.** Add `.docs/api/work-orders.md` and
  `.docs/frontend/work-orders.md`; link them from `.docs/README.md`. Update access,
  estate-report conversion entry point, source links, capabilities and estate-entry
  documentation. Run `pnpm fix`, `pnpm check-types`, `pnpm test` and the web build
  through existing Nx scripts/targets. `apps/web/package.json` already has a
  `check-types` script; the older architecture note saying otherwise is stale.
  Use offline Maven for installed dependencies; install nothing. Review
  phone/desktop layouts, keyboard access and both themes. Leave all work
  uncommitted for the human.

## Open questions

None for the current business scope. Direct saved-inspection integration and
work-order progress/completion permissions remain decisions for their later stories.

## Review references

- [Estate report API](../../.docs/api/estate-reports.md) and
  [screens/hooks](../../.docs/frontend/estate-reports.md).
- [Current access projection](../../.docs/api/access.md),
  [estate role decision](../decisions/0028-estate-role-invitations.md) and
  [responder decision](../decisions/0029-fault-report-responder-access.md).
- `feat/create-work-order` now starts at `c17d708`, including our four tested
  fixes. Its old `79b9b5f` tip is preserved as
  `backup/create-work-order-79b9b5f`. The draft remains uncommitted. PR #32 is
  still open with the CI issue recorded above; do not describe its changes as
  merged into `main`. The human handles any later merge/rebase under AGENTS.md
  rule 13.

## Review refinements (2026-10-22)

Creator metadata uses the current display name through the existing WorkOS
lookup on creation/detail responses, preserving the stored audit ID. Lookups
happen after authorization and outside creation locks; unavailable names do not
block orders. This also supports existing orders without a migration. The UI
shows a readable fallback instead of the raw account ID.

The optional asset link is one picker button. Its popup contains search and
results; there is no standalone search field in the work-order form. This avoids
making search look like saved work-order information.

Navigation review refinement: the work-order estate switcher matches the normal
estate trigger (building icon, estate name, chevrons; no extra field title).
From Home, the estate directory or an estate without work-order permission,
Work orders opens an explicit authorized-estate chooser instead of selecting the
first result. Report permissions remain independent until a different rule is
explicitly agreed.

Navigation consistency refinement: both Work orders and Respond to faults use
the same estate-choice flow outside a matching estate, and share icon-and-name
estate switcher presentation inside their routes. Sidebar chooser buttons match
link alignment and spacing. Work orders uses a wrench icon, distinct from fault
reports. Existing report membership permissions remain unchanged.

## Agreed list-filter refinement (2026-10-23)

The user approved Priority and Search reference now, with status filtering deferred
to ID-38 when other statuses and their transitions are implemented.
Implemented and verified with the full uncached test suite, type checks,
formatting and the production web build on 2026-10-23.

Manual review requests filtering the work-order list. This moves a small part
of the previously deferred ID-38 read scope into ID-36; it does not add status
transitions, assignment or closure.

- Add a Priority dropdown: All priorities, Low, Medium, High and Urgent.
- Add Search reference, matching the visible reference (for example MG-W0001),
  case-insensitively and literally, with partial matches and a 200-character
  limit. Do not label the opaque database UUID as the user-facing work-order ID.
- Combine both criteria with AND. Filter on the server before cursor pagination,
  always within the authorized estate. Preserve newest-first ordering.
- Extend GET `/estates/{estateId}/work-orders` with optional `priority` (existing
  priority enum) and `q` (trimmed reference search) query parameters. Unknown
  priorities or overlong searches return 400. Regenerate the API contract.
- Use shadcn Select, Input and Button outside the results table, with Apply
  filters and Clear filters. Store applied priority/search/cursor in the URL;
  applying or clearing filters resets pagination. Refresh/back/forward retain
  the applied choices. Query keys include all criteria and the authenticated user.
- Distinguish No matching work orders from No work orders yet. Clearing criteria
  restores the unfiltered first page. Existing loading, retry and access rules
  remain in force.
- Defer status selection to the workflow story: the current API/database only
  allow OPEN and there is no close operation. An Open/all toggle would currently
  return identical results. Add status filters when additional statuses exist.
- Verify priority/reference combinations across pages, literal search characters,
  invalid inputs, estate isolation, URL restoration, clearing and no-match states.

The independently requested breadcrumb bug fix links the estate name to its
overview on list/create/detail for accounts with management access. Crew keep
the estate label as plain text because they cannot enter the management overview.

The user subsequently approved sortable existing columns in work orders and the
asset register. See [table-column-sorting.md](table-column-sorting.md): priority,
reference, category and creation sorting preserve filters and pagination; status
sorting remains deferred until additional work-order statuses exist.
