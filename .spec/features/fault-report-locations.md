# Fault report locations for responders

**Status:** built and verified; implementation authorized by the user on
2026-10-18; tests observed failing before implementation and now passing
**Owner:** unassigned
**Related features:** [Resident fault reporting](resident-fault-reporting.md),
[resident authorization](resident-estate-user-authorization.md),
[location hierarchy](location-hierarchy.md),
[estate role invitations](estate-role-invitations.md)

## Problem

Responders need to identify where a fault is, find reports for a building or
particular area, and correct reports placed at the wrong location.

The first acceptance criterion is already implemented: `IssueReport.locationId`
is required, with a composite foreign key to a `Location` in the report's estate.
Report creation accepts an active LEVEL or COMMON_AREA. Resident list/detail
responses already contain the referenced node ID and its full location label.

The missing pieces are estate-wide responder list/detail access, hierarchy
filtering and an authorized relocation operation. Existing `/resident/reports`
endpoints expose only the caller's own reports and must retain that policy.

## Acceptance criteria mapping

| Story criterion | Current state | Planned work |
| --- | --- | --- |
| Reports reference a location node | Required same-estate reference exists. | Preserve and verify it for creation and relocation. |
| Location appears in detail and responder lists | Resident detail/list already display it; responder screens do not exist. | Add responder screens with full paths, including historical locations. |
| Filter by a node or any parent | No responder report filter. | Filter in the server query by the selected node and all its descendants. |
| Correct an initially wrong placement | No relocation endpoint. | Add a same-estate relocation action with validation and concurrent-edit protection. |

## Behaviour

### Responder access

- **Revised by the user on 2026-10-18:** Managers (also called Admins) and Crew
  have CRUD access to all fault reports in their assigned estates, including
  residents' submissions. Current staff editing is limited to location: this
  location story implements their list/detail/image reads, filtering and
  relocation, retaining all other report information. Broader report editing
  and deletion are out of scope. The latest role matrix supersedes the earlier
  owner/manager/council responder list.
- Resolve responder authority from current `EstateUser` MANAGER or CREW rows
  in the requested estate. Owners retain manager membership; ownership is a
  separate relationship, not a responder role. Manager/Admin is one role;
  no separate platform-admin role grants a bypass.
- A role in A grants no responder rights in B. COUNCIL, RESIDENT, unrelated
  accounts and unknown roles grant no estate-wide responder access.
  Legacy MEMBER grants retain their existing permissions; this feature does
  not reinterpret them as COUNCIL. Same-estate resident/owner conflicts continue
  to fail closed. Revocation takes effect on subsequent requests with the same JWT.
- Resident list/detail/image endpoints remain submitter-only, including after
  assignment removal. Responders use separate estate-scoped endpoints; resident
  URLs never become a way to read another person's reports.
- Responders may read reports and private images for an inactive estate, while
  retaining current estate access. Relocation requires an active estate. Crew
  report access does not grant estate, asset, location-node or device writes;
  it includes only supporting location reads for reports.
- This story uses the Manager/Crew report authority in the revised invitation
  plan. It does not create a new RESPONDER membership role. MANAGER and CREW
  support depend on that plan; no WorkOS role claim substitutes for membership.

### Location reference and display

- Every report retains exactly one non-null location reference in its estate.
  Creation continues to require an active LEVEL or COMMON_AREA with active
  ancestors. Responders can change the block, level and common area selections,
  including moving a report to another block in the same estate. The saved
  reference identifies the selected level or common area and determines its
  block; the existing rule against a block-only placement remains.
- Each responder list item and detail displays the full current path, for
  example `Block A › Level 4 › Lift lobby`, alongside the report title/status.
  Duplicate names under different parents remain distinguishable.
- Locations and their ancestors remain readable when deactivated. Historical
  reports retain their references and labels; deactivation does not remove
  reports from unfiltered or matching filtered results.
- Names and paths are resolved from the referenced nodes at read time. Renaming
  a location updates the displayed label without changing `locationId`. Moving
  a hierarchy node updates its descendants' paths and filter ancestry. This
  feature stores no immutable location-name snapshot.

### Hierarchy filtering

- The estate's responder list accepts an optional `locationId`. Without it,
  return all reports in that estate. With it, return reports attached directly
  to that node or any descendant, including inactive nodes.
- Selecting a block includes its levels, common areas directly under the block,
  and common areas under those levels. Selecting a level includes reports at
  that level and its common areas. Selecting a common area includes that node.
  Selecting All locations clears the filter and represents the estate root.
- Filtering uses node IDs and parent relationships, never text/path prefixes.
  A missing node or a node in another estate returns 404; a malformed UUID is
  400. An authorized empty subtree returns 200 with an empty result page.
- Filtering is applied before pagination. Results use the existing report order
  `(createdAt DESC, id DESC)` and opaque cursor pagination, with default limit
  20 and maximum 50. Location changes do not alter creation order.
- Changing the selected location resets the cursor. Filter state is reflected
  in the page URL and query key, so refresh, back navigation and pagination
  retain the selected location without mixing pages from different filters.

### Relocation

- Report detail offers **Change location** to authorized responders on active
  estates. The dialog shows the current path and an active same-estate location
  picker with editable Block, Level and Common area selections. Changing a block
  clears the previous level/common area; changing a level clears the previous
  common area, so the final selection always forms a valid hierarchy. Support
  common areas directly under a block as well as those under a level. Save the
  resulting LEVEL or COMMON_AREA node as the report's `locationId`.
- **Confirmed by the user on 2026-10-18:** corrections remain within the
  original estate. Retain only the corrected location and `updatedAt`; do not
  add relocation history or require a correction reason.
- The request contains the destination `locationId` and `expectedLocationId`
  observed by the editor. It cannot change estate, submitter, title,
  description, status, images or creation time.
- Spring rechecks responder authority, estate activity, report estate, current
  placement and destination/ancestor activity inside one transaction. Locking
  follows the existing estate-first hierarchy-write convention, with current
  membership checked/locked as needed to serialize revocation and the write.
- A stale `expectedLocationId` returns 409 and preserves the current placement.
  After refetch, the responder can deliberately apply their correction. If the
  expected and destination IDs both equal the current ID, return the unchanged
  report without advancing `updatedAt`.
- A successful correction changes only `locationId` and `updatedAt`, returning
  the updated detail. Invalid destinations or failed writes leave the report
  unchanged. Preserve ID, estate, submitter, title, description, status, creation
  time, image IDs/metadata and the stored image contents. No image is uploaded,
  replaced or deleted by relocation. `updatedAt` records the correction; it is
  not an additional staff-editable field.
- Subsequent responder and resident reads show the corrected location. Under an
  existing location filter, the report appears or disappears according to its
  new node's ancestry. Invalidate affected lists/details in the current browser;
  other sessions see changes on refetch. Live push updates are not required.

## Data

| Prisma model | Planned change |
| --- | --- |
| `IssueReport` | Retain required `locationId` and composite `(locationId, estateId)` foreign key with restrictive deletion. Add indexes on `(estateId, createdAt, id)` and `(estateId, locationId, createdAt, id)` for estate list pagination and subtree-filtered reads. Retain existing submitter-history index. Relocation updates the reference and existing `updatedAt`. |
| `Location` | No shape change. Reuse node identity, parent relationships, estate boundary and deactivation state. Existing parent/estate indexes support descendant traversal. |
| `IssueReportImage` | No shape change. Images stay attached to the same report. |
| `Estate`, `EstateUser` | No shape change in this story. Read current MANAGER/CREW membership and estate state for authorization. New role support and owner manager-membership invariants belong to the separate estate role plan. |

There is no location backfill: valid existing reports already have a reference.
No new report copy, free-text location field, hierarchy table or relocation log
is needed. The expected-location comparison avoids adding a version column.
Index changes use Prisma-owned migrations, followed by `pnpm db:generate` for
jOOQ regeneration. Spring never migrates the database.

Reuse the existing asset search approach to descendant traversal: an
estate-scoped recursive query seeded with the selected node. Keep estate
conditions on both traversal and report selection. Do not fetch a report page
and filter it in the browser, which would produce incomplete result pages.
Build location paths in the query/batched hierarchy projection rather than one
query per report. Deactivated nodes remain part of historical traversal.

## API

The following endpoints are additions. Resident own-history endpoints and
same-estate location validation remain unchanged. Multi-estate resident context
and creation changes belong to the revised invitation plan. All endpoints
require an authenticated JWT subject
even when resource-server authentication is disabled for local development.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/reports` | Optional `locationId: UUID`, `cursor: string`, `limit: integer` (1–50) | 200 existing `IssueReportPageResponse` | Current estate responder. |
| GET | `/estates/{estateId}/reports/{reportId}` | UUID paths | 200 existing `IssueReportDetailResponse` | Current estate responder; report must belong to this estate. |
| PATCH | `/estates/{estateId}/reports/{reportId}/location` | `RelocateReportRequest { locationId: UUID, expectedLocationId: UUID }`, both required/non-null | 200 updated `IssueReportDetailResponse` | Current estate responder; active estate and valid destination. |
| GET | `/estates/{estateId}/reports/{reportId}/images/{imageId}` | UUID paths | 200 private JPEG/PNG bytes | Current estate responder; image must belong to that report in this estate. |

Extend these existing contracts:

| Endpoint | Change |
| --- | --- |
| GET `/access/context` | Add `estateName: string` for report estate choices and capabilities `canViewFaultReports: boolean` and `canRelocateFaultReports: boolean`. View is true for current responders; relocate additionally requires an active estate. All other roles default false. Crew report access permits workspace entry without general management access. |
| GET `/estates/{estateId}/locations` | Permit responders to read `includeInactive=true` for historical filtering. Preserve the existing `LocationResponse[]`, existing active reads, and all independent location-write restrictions. |

Reuse real Java report DTOs without adding submitter profiles, contact details,
storage keys or management notes. Relevant fields:

- `IssueReportSummaryResponse`: `id: UUID`, `title: string`,
  `description: string`, `estateName: string`, `location: { id: UUID,
  label: string }`, `status: string`, `createdAt: datetime`, `updatedAt: datetime`.
- `IssueReportDetailResponse`: summary fields plus
  `images: { id: UUID, contentType: string }[]`.
- `IssueReportPageResponse`: `items: IssueReportSummaryResponse[]`,
  `nextCursor: string | null`.

Example: GET `/estates/{estateId}/reports?locationId={blockAId}` includes a
report whose stored location is the lift lobby below Block A's Level 4. PATCH
`/estates/{estateId}/reports/{reportId}/location` with
`{"locationId":"<correct-level-uuid>","expectedLocationId":"<old-lobby-uuid>"}`
returns the same report ID with the corrected node ID/path and new `updatedAt`.

Errors use `EstateError { message: string }`: 400 malformed parameters, missing
body fields, invalid pagination or a BLOCK placement; 401 missing identity; 403
known estate access without responder authority, including RESIDENT; 404
inaccessible estate, missing/cross-estate report or destination, or image not
attached to that report; 409 stale placement, inactive estate or inactive
destination/ancestor; 503 private-image storage unavailable. Image responses
retain `Cache-Control: private, no-store`, private bucket storage and generic
provider errors. Filter/detail responses are private and not publicly cached.

Add explicit method/path entries in `SecurityConfig`, retaining its final
deny-all rule. Keep controllers thin, DTOs validated with Jakarta constraints,
and estate-scoped business authorization in services/repositories. Regenerate
OpenAPI and frontend types; do not hand-write API contracts in the web app.

## Frontend

- Add folder-based routes under
  `apps/web/src/routes/_auth/estates/$estateId/reports/`: `index.tsx` for the
  responder list and `$reportId/index.tsx` for detail. Route-only components
  belong in adjacent `-components/` folders. Existing `/reports` remains the
  resident's personal report history.
- Show **Fault reports** in the target estate's navigation only when
  `canViewFaultReports` is true. Gate route entry and query mounting by that
  server capability; do not infer responder rights from broad management access
  or a WorkOS organization role. Direct requests are independently authorized.
- Crew-only accounts land on assigned reports from Home and can switch between
  report estates using named choices in access context. Their report navigation
  does not mount management estate queries or grant overview access. The label
  projection and navigation were added after failing tests exposed this entry gap.
- The report estate selector includes all assigned Manager/Crew report estates.
  A global Respond to faults entry appears outside a report-capable estate so
  mixed Council/Crew accounts can reach their report work.
- List: use existing shadcn Card/Badge/Button/Select/Label components, report
  title links, full location paths, status and submission time. Provide a
  labelled Location filter with All locations plus full-path node choices,
  including marked inactive locations for history. Include loading, retry,
  empty-list, no-matches, clear-filter and next-page states.
- Detail: show title, description, full location path, status, timestamps and
  private images using the report presentation conventions already in use.
  Fetch responder images through their new authorized endpoint, not a resident
  image URL. Retain object URL cleanup and safe plain-text rendering.
- Relocation: use a shadcn Dialog and labelled hierarchical Select controls.
  Allow changes to Block, Level and Common area within the original estate,
  clearing dependent selections when a parent changes. Show the current
  placement even if inactive, but allow only active valid destinations.
  Save disables repeat submissions; errors preserve the selected
  destination. A 409 explains that placement changed and offers Reload before
  another correction. Do not optimistically overwrite report placement.
- Put generated-client React Query hooks in
  `apps/web/src/lib/estate-reports.ts`. Keys start with the current user ID:
  `[userId, "estate-reports", estateId, "list", locationId, cursor, limit]`,
  `[userId, "estate-reports", estateId, "detail", reportId]` and a similarly
  scoped image key. A changed location resets pagination before fetching.
- Successful relocation invalidates all current-user report lists for that
  estate and the affected detail, plus matching personal report queries when
  the responder is also the submitter. Refetching on focus exposes corrections
  made in another browser. Session changes clear the old user's queries.

## Edge cases

- Same location names in different blocks: IDs and full paths distinguish them;
  filtering one block never includes another with a matching name.
- A report was placed in the wrong block: a responder can select another block
  in the same estate and its valid level/common area. Save updates the full
  displayed path and filter membership while preserving other report data.
- A common area lives directly under a block, rather than a level: the block
  filter still includes it and its path has no invented level segment.
- A location or ancestor is renamed/reparented/deactivated: references remain,
  current paths and subtree results follow the hierarchy; inactive destinations
  cannot be newly assigned. Historical filter options remain selectable.
- A parent filter returns more than one page: every page applies the same
  descendant predicate; equal timestamps use report ID as the tie-breaker.
  Lists use current data, not a frozen snapshot across hierarchy edits.
- A report is relocated while a filtered list is open: refetch removes it from
  the old subtree and includes it in the new one without changing creation order.
- Two responders relocate the same report from the same initial node: the first
  correction commits, the second receives 409 and cannot silently overwrite it.
- Estate/location deactivation, hierarchy edits or membership removal race a
  relocation: use the same estate/membership locking boundaries, recheck inside
  the transaction, and leave no partially updated report.
- A client mixes estate, report, location and image IDs from different estates:
  server queries enforce every relationship, regardless of UI-selected IDs.
- A resident keeps historical report access after revocation or relocation;
  another resident cannot view or relocate that report. Responders do not need
  the submitter to retain membership to read an estate's historical reports.
- No active destinations exist: report history remains readable and the dialog
  explains why no correction can be saved. Empty matching subtrees return a
  normal no-matches state, distinct from loading and permission failures.

## Implementation phases

- [x] Revise responder scope to Manager/Admin and Crew under the latest role
  matrix; Council has asset CRUD and estate-dashboard reads (2026-10-18).
- [x] Confirm that staff can edit location only and that every other report
  field and image is retained, apart from the correction's `updatedAt`
  (2026-10-18). Asset editing and account migration are outside scope.
- [x] Confirm same-estate corrections, changes to block/level/common-area
  selections, and no relocation history or required reason (2026-10-18).
- [x] Agree this spec before implementation. Record the new staff-report read
  and relocation authorization boundary in an ADR referencing 0026/0027;
  preserve the resident endpoints' ownership policy.
- [x] Write and observe failing HTTP/database tests for responder visibility,
  resident/foreign-estate denial, full paths, private image access and historical
  locations. Implement the smallest scoped read APIs and access capabilities.
- [x] Write and run failing tests for node/parent filtering before pagination,
  direct block common areas, inactive nodes, duplicate names and stable cursor
  ordering. Add descendant queries and Prisma indexes; migrate and regenerate
  jOOQ with `pnpm db:generate`, then compile Java.
- [x] Write and observe failing relocation tests for valid moves, invalid nodes,
  preservation of all other fields and images, resident history after correction,
  stale placement, no-op updates, revocation and races with
  hierarchy/estate changes. Implement transactional relocation and error mapping.
- [x] Run `pnpm api:generate` and keep OpenAPI/generated TypeScript alongside the
  backend changes. Do not install dependencies or alter WorkOS roles.
- [x] Write and run failing web tests for responder list/detail, full-path
  filtering, URL/cursor reset, private images, relocation success/failure and
  stale-edit recovery. Implement generated-client hooks, route guards and shadcn UI.
- [x] Run targeted tests through Nx during each red/green loop, followed by
  `pnpm check-types`, `pnpm test` and `pnpm fix`. Use isolated migrated PostgreSQL
  for database tests and mocked private storage; inspect the final diff.
- [x] Add `.docs/api/estate-reports.md` and `.docs/frontend/estate-reports.md`;
  update resident-report, location, access and shell docs where their contract
  or navigation changes, and link them from `.docs/README.md`. Update this spec's
  status. Leave all changes uncommitted for the human.

## Out of scope

- Implementing multi-estate resident selection in this location story (covered
  by the estate role plan), or making block-only placement valid.
- A new responder role, assignment queue, dispatch workflow, report status
  transitions, notifications, reporter contact details or internal notes.
- Cross-estate report transfer, bulk relocation, map coordinates or indoor routing.
- Report text/status/image editing and deletion. Location is the only currently
  editable report field; broader CRUD role intent does not expand this scope.
- Asset editing or existing-account migration.
- Adding a relocation audit timeline or requiring a correction reason. This
  operation changes only current placement and `updatedAt`.
- Replacing the location hierarchy, creating nodes from the report picker,
  immutable location snapshots or guaranteed snapshot pagination during edits.
- Granting Council report access or estate/location/device writes. Council
  asset CRUD is required separately by the revised estate role policy.

## Acceptance tests

The user requested tests first on 2026-10-18, then authorized implementation.
The responder endpoints, generated contracts and screens are implemented. The
initial red suite demonstrated missing behavior before implementation; all feature
tests now pass. Additional red/green tests covered Crew-only and mixed-role entry
and estate labels without expanding general management access.

| Test file | Coverage |
| --- | --- |
| `apps/server/src/test/java/com/proj/server/config/FaultReportSecurityTests.java` | JWT authentication for the four responder operations, identity independent of WorkOS role claims, and deny-by-default protection for other methods and nested actions. |
| `apps/server/src/test/java/com/proj/server/FaultReportLocationsIntegrationTests.java` | Manager/Crew access; estate isolation; Council/Resident/Member denial; submitter-only resident URLs; access capabilities; private images; historical locations and inactive estates; subtree filters before pagination; duplicate names; direct-block common areas; stable order; dynamic paths after rename/reparenting; same-estate relocation; every other field and image preserved; stale/no-op/invalid requests; revocation; concurrent editors and estate/ancestor/destination/membership/reparenting races. Uses Prisma-migrated disposable PostgreSQL and mocked image storage. |
| `apps/web/tests/components/app-navigation.test.tsx` | Desktop/contextual report links and active state for Manager/Crew, inactive-estate read navigation, capability isolation/revocation, Crew estate switching without management queries, and mixed-role entry. |
| `apps/web/tests/routes/index.test.tsx` | Crew-only Home redirect to assigned report work. |
| `apps/web/tests/routes/_auth/route.test.tsx` | Crew entry without general management rights, blocking Council/foreign-estate capability reuse and WorkOS-admin bypass before child loaders run. |
| `apps/web/tests/routes/_auth/estates/$estateId/reports/index.test.tsx` | Registered list/detail routes, full paths and responder image URLs; URL filters, history, clearing and cursor reset; empty/error states; block/level/common-area correction, including direct-block common areas; stale edits, failed saves and duplicate submission prevention; list refetch after relocation; inactive destinations and no active options; safe text rendering and image/session cleanup. |

Web tests use the actual generated route tree and mock external HTTP/session
boundaries. They do not import hypothetical screen modules. Missing screens
therefore fail as unavailable pages or missing accessible controls, rather than
module-resolution errors. Production API types are regenerated from Spring DTOs;
no production API types are hand-written.

Existing resident report tests retain coverage for required creation placement
and resident ownership/history. Database index choice, query count/performance,
generated code and shadcn internals are not asserted: tests cover observable
filtering, pagination, state and access behavior instead.

Run the focused suites from the repository root:

```bash
MAVEN_ARGS=-o pnpm nx run server:test --args='-Dtest=FaultReport*Tests' --skip-nx-cache
pnpm nx run web:test --skip-nx-cache -- reports/index.test.tsx tests/components/app-navigation.test.tsx tests/routes/_auth/route.test.tsx
pnpm check-types
```

The report-screen filename filter also runs the existing resident list tests.
It avoids passing a literal `$estateId` through Nx's additional shell layer.
Docker access is required for the integration suite; the Docker CLI itself is
not required when Testcontainers can reach the Docker daemon.

Verification on 2026-10-18:

- All 69 focused Java feature cases pass. The full Java regression suite runs
  536 tests with zero failures, errors or skips on migrated disposable PostgreSQL.
- The full workspace `MAVEN_ARGS=-o UV_NO_SYNC=1 pnpm test` command passes for
  server, web and ML. Web includes the 22 report-screen cases, route guards,
  responder navigation and new Crew-only/mixed-role entry tests.
- `pnpm check-types` and the frontend Nx production build pass. Scoped
  `pnpm fix` for changed web/API files and targeted Nx/Spotless formatting for
  changed Java files pass; `git diff --check` passes.
- `pnpm db:migrate -- --name fault_report_locations` created and applied
  `20261018150454_fault_report_locations` to development. `pnpm db:generate`
  regenerated Prisma and jOOQ. `pnpm api:generate` regenerated OpenAPI/TypeScript;
  generated contracts were then formatted using the API package's existing tool.
- One test-only correction checks retained report text underneath a modal rather
  than expecting its background heading in the accessibility tree. Two existing
  estate-detail tests had stale `Council members` expectations and now assert
  the existing `Estate members` label; that screen's implementation was not changed.
- As-built API/frontend documentation and ADR 0029 record the feature and access
  boundary. All changes are uncommitted for the human.

## Confirmed decisions

The latest role policy confirms Manager/Admin and Crew as report responders;
Council does not have estate-wide fault-report access. The user confirmed
location-only staff editing with all other report information preserved.
On 2026-10-18 the user also confirmed that corrections stay within the original
estate, that the block, level and common area can be changed, and that no
relocation history or correction reason is needed. The picker supports changing
any of those hierarchy selections while retaining the existing LEVEL/COMMON_AREA
saved-reference model. The user agreed the plan and authorized implementation;
the feature is now built and verified.
