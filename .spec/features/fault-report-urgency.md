# Fault report urgency

**Status:** implemented and integrated with ID-74 on 2026-11-07 — latest validation recorded below
**Owner:** feature branch `feat/report-urgency`
**Jira:** [ID-72](https://notjira.atlassian.net/browse/ID-72)

## Problem

Managers currently receive a report list ordered by creation time. They cannot
identify or change a report's urgency, and routine reports can obscure hazards.
The existing `IssueReport` has no urgency or safety classification. Resident
submission and personal history share response DTOs with estate responders.

## Behaviour

The following rules incorporate the recommendations accepted on 2026-11-07.

### Urgency and safety

- Urgency has four fixed values: `LOW`, `MEDIUM`, `HIGH`, `URGENT`, labelled
  Low, Medium, High and Urgent. Use a Java enum at request/response boundaries.
- Existing and newly submitted reports start at Medium, with `isSafety = false`.
  No text-based, image-based or AI classification is introduced by this story.
- Managers can change urgency and mark or unmark a report as Safety in one save
  from the estate report detail screen.
- Marking Safety sets urgency to Urgent. The API rejects a request combining
  `isSafety = true` with an urgency below Urgent; the UI selects and locks Urgent
  while Safety is checked.
- Unmarking Safety does not silently lower urgency. The manager can choose a
  different urgency in the same save.
- A routine report can also be Urgent. In the default urgency ordering, Safety
  reports sort ahead of routine reports, including routine Urgent reports.
- Changing urgency/safety preserves the report's title, description, location,
  images, submitter, creation time and existing work orders.
- Work-order priorities are independent and are not rewritten by this feature.

### Queue and pagination

- The estate queue defaults to Open reports. An All reports option retains access
  to historical reports. Both views offer Safety and urgency (default) and
  Newest first and Oldest first sorting.
- For this queue, a report is open when it has no source work orders, or at least
  one source work order whose status is not `CLOSED`. It is resolved for queue
  purposes when it has work orders and all of them are `CLOSED`.
- Derive openness from work orders in the same estate. Do not introduce a report
  lifecycle or mutate `IssueReport.status` to maintain this view.
- If ID-70/PR #43 has landed, a report with routing state `DISMISSED` is excluded
  from Open regardless of whether it has a work order. All reports still includes
  it. Do not add routing tables or a dismiss action merely to implement ID-72.
- Apply the existing location/block/level filters and the open-only condition
  before pagination.
- Order in PostgreSQL via typed jOOQ: Safety first, urgency descending, then
  `createdAt DESC, id DESC`. Equal-priority reports retain the existing newest-first
  order. Newest first uses only `createdAt DESC, id DESC`; Oldest first uses
  `createdAt ASC, id ASC`. Both ignore urgency/Safety. Sorting is never limited to the fetched browser page.
- The cursor includes the ordering keys and is scoped to the estate and applied
  filters and selected sort. Invalid or mismatched cursors return 400. An old creation-time-only
  cursor is rejected with a reload-first-page message.
- Changing queue filters or sorting resets the cursor; Next/First, URL refresh
  and browser navigation preserve the applied view, location filters and sort.
- With unchanged data, paging has no missing or repeated rows. Concurrent urgency
  changes may move reports between pages; refreshing from the first page loads
  the current queue. Snapshot pagination is outside this story.
- Existing consumers such as work-order source selection can still request all
  reports. The optional API `openOnly` filter defaults to false; the queue UI
  explicitly requests true for its initial Open view.

### Authority and recorded changes

- Current same-estate MANAGER members can change urgency in an active estate.
  Ownership qualifies through the existing MANAGER membership invariant.
- CREW and CUSTOM users with `VIEW_FAULT_REPORTS` can read the urgency, Safety
  marker and latest change, but cannot change them. Resident/Member/Council and
  identity-provider claims do not grant editing authority.
- Missing identity returns 401, known unauthorized membership returns 403, and
  inaccessible/missing estate/report relationships return 404 without exposing
  foreign records. Inactive estates remain readable; changes return 409.
- Lock the estate before checking membership/activity and updating the report,
  consistent with the existing mutation lock order.
- Every real change appends an event recording previous/new urgency, previous/new
  safety classification, actor subject, server time and the resulting version.
  Event insertion, version increment and report update share one transaction.
- Changes require the `expectedVersion` observed by the caller. A stale version
  returns 409 and writes nothing, including when values have changed and changed
  back. A valid no-op returns the current report without adding an event or
  incrementing the version.
- Version checks concern urgency/safety only; correcting a location does not
  silently overwrite urgency or manufacture an urgency event.

### Screens

- Estate report cards and detail show a text-labelled urgency Badge and a Safety
  Badge when marked. Color alone never conveys urgency.
- Report detail offers a Change urgency dialog to authorized Managers, with a
  shadcn Select, Safety Checkbox and Save/Cancel actions.
- Saving disables repeat submission. Failures retain the draft. A 409 offers
  Reload and requires review of the latest values before retrying.
- Detail displays only the latest urgency/safety change, with previous/new values,
  actor display name when available, and time. Retain every event in the database;
  a full history browser and history endpoint are outside this story. An unavailable
  name does not prevent an authorized read or save; show Name unavailable. Reports
  without any real changes show no change metadata.
- Reuse the existing folder-based report routes, shared page components, shadcn
  primitives and `apps/web/src/lib/estate-reports.ts` for queries/mutations.
- All private query keys start with user ID. Success updates detail (including its
  latest-change metadata) and invalidates that estate's report lists.
  Revocation/session changes follow existing access and query cleanup behavior.
- Resident submission/history contracts and their chronological order are
  preserved; urgency and staff audit data are exposed through estate-only DTOs.

### Match the existing UI

- Follow `.docs/frontend/design-system.md` and the current report screens as
  the visual reference. Keep the existing `PageLayout`, `ListPageHeader`,
  `DetailPageHeader`, report-card layout, breadcrumbs, typography and spacing.
- Place urgency and Safety badges with the existing report status metadata,
  using stock shadcn `Badge` variants and readable text. Do not redesign report
  cards or add custom colors, CSS overrides or new theme tokens.
- Put the Open/All reports and Sort by selectors in the existing report `FilterBar` using a
  labelled shadcn `Select`; retain the existing filter toggle, apply/clear
  behavior and shared `Pagination`. It is a filter on the same list, not a new
  destination or a new tab/navigation system.
- Follow Change location for the Change urgency interaction: an outline action
  on report detail and the existing `components/dialogs/form-dialog.tsx`, with
  labelled Select/Checkbox fields, the standard Save/Cancel footer, pending
  locking and Reload as a secondary action after a conflict.
- Show the latest-change information as compact muted metadata in the existing
  report details. Do not add a separate history page or a large history card.
- Retain existing shared loading, empty and error components, keyboard/focus
  behavior and query feedback conventions. Preserve Create work order and
  Change location actions and any subsequently integrated duplicate/routing UI.
- Verify that badges and actions wrap without horizontal page overflow on mobile,
  the dialog fits short viewports, and all additions use the existing light/dark
  theme tokens. Include keyboard operation and 200% zoom in the manual UI check.

## Data

Prisma remains the schema owner. Add to `IssueReport`:

| Field | Type | Default |
| --- | --- | --- |
| `urgency` | VarChar(20), constrained by the application enum | `MEDIUM` |
| `isSafety` | Boolean | false |
| `urgencyVersion` | Integer | 0 |

Add `IssueReportUrgencyEvent`:

- `id: UUID`, `estateId: UUID`, `reportId: UUID`.
- `version: integer`, `fromUrgency/toUrgency: VarChar(20)`.
- `fromIsSafety/toIsSafety: boolean`.
- `changedByUserId: VarChar(255)`, `changedByName: VarChar(255)?`,
  `changedAt: Timestamptz(6)` (server time).
- Composite `(reportId, estateId)` foreign key to `IssueReport(id, estateId)`
  with restrictive deletion/update rules; unique `(reportId, version)`.
- Capture an available display-name snapshot outside the write transaction using
  the existing account-name lookup pattern; record the authenticated subject even
  when no name can be obtained.

Use an additive migration with defaults so older deployed code can continue
creating reports. Reuse existing estate/location indexes for filtering; the
application-enum CASE rank is sorted in PostgreSQL rather than alphabetically.
No matching expression index is added: Prisma cannot model the CASE expression,
and this story keeps Prisma as the sole schema source. A dedicated queue index
is a future measured optimization rather than a redundant alphabetical index.
Regenerate jOOQ through the existing
database generation workflow; no hand-edited generated sources or runtime raw SQL.

## API

`packages/api/openapi.json` is authoritative and must be regenerated with
`packages/api/src/schema.ts` after changing controller/DTO contracts.

| Method | Path | Request | Success | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/reports` | Existing filters plus optional `openOnly: boolean = false`, `sort: URGENCY \| NEWEST \| OLDEST = URGENCY`; existing cursor/limit | 200 estate report page in the selected order | Existing estate report read authority |
| GET | `/estates/{estateId}/reports/{reportId}` | Existing path parameters | 200 estate report detail with urgency fields and latest-change metadata | Existing estate report read authority |
| PATCH | `/estates/{estateId}/reports/{reportId}/location` | Existing request | Existing behavior, returning the estate detail DTO | Existing relocation authority |
| PATCH | `/estates/{estateId}/reports/{reportId}/urgency` | `ChangeReportUrgencyRequest` | 200 updated estate detail | Current MANAGER, active estate |

- Estate summary/detail DTOs add required `urgency: ReportUrgency`,
  `isSafety: boolean`, `urgencyVersion: integer`. Preserve all existing fields.
- `ChangeReportUrgencyRequest` has required non-null `urgency: ReportUrgency`,
  `isSafety: boolean`, `expectedVersion: integer >= 0`.
- Estate detail additionally has required `lastUrgencyChange: ReportUrgencyChange | null`.
  Emit and verify an explicit object-or-null union in the generated contract.
- `ReportUrgencyChange` has `id: UUID`, `version: integer`,
  `fromUrgency/toUrgency: ReportUrgency`, `fromIsSafety/toIsSafety: boolean`,
  `changedByName: string | null`, `changedAt: date-time`. Do not expose actor
  account IDs through this DTO. Select the latest event only for detail responses;
  list responses do not load or expose change history.
- Access context adds `canChangeFaultReportUrgency: boolean`, true only for a
  current MANAGER membership in an active estate.
- Every endpoint requires identity and returns `Cache-Control: private, no-store`.
  Document 400/401/403/404; the mutation also returns 409 for inactive estates or
  stale versions. Use existing `EstateError` responses without database details.

Example mutation:

```json
{"urgency":"URGENT","isSafety":true,"expectedVersion":0}
```

## Edge cases

- Migration/backfill and new submissions have explicit defaults and no invented
  historical actors or events.
- Safety cannot be demoted by a crafted request. Removing Safety requires an
  explicit manager edit and is recorded alongside any urgency change.
- Equal timestamps, different UUIDs, location filters and more than one page
  retain the full database order. Reject old or cross-estate/filter cursors.
- All-closed, mixed-open/closed and no-work-order cases derive openness correctly;
  report status and work-order priority are not treated as interchangeable.
- If routing is present on the implementation base, dismissed reports stay out
  of Open, and the Open filter combines with existing routing-state filters
  before pagination. All reports retains dismissed history.
- Cross-estate report IDs, revoked memberships, inactive estates and conflicting
  Resident memberships cannot grant edit rights through ownership or UI state.
- Concurrent editors, changed-back values, valid no-ops and failed transactions
  cannot overwrite unseen changes or leave audit rows without their report update.
- Empty lists, absent change metadata, failed reads/saves and missing actor names have clear UI
  feedback. Historical inactive locations remain readable as today.
- ID-74 is a separate PR. Do not merge or implement duplicate handling here.
  If its estate DTOs land before implementation, extend those DTOs instead of
  creating competing duplicate response types.

## Integration with open PRs

Checked on 2026-11-06. These are overlap risks, not requirements to implement
either feature as part of ID-72:

- [PR #54 / ID-74](https://github.com/notsql/Upkeep/pull/54) adds duplicate
  handling, estate-only `EstateIssueReport*Response` DTOs, report-card badges,
  detail actions and access capabilities. It overlaps the report controller and
  service, web report routes/hooks/tests, Prisma schema and generated contracts.
  Preserve its duplicate metadata/actions if it lands first.
- [PR #43 / ID-70](https://github.com/notsql/Upkeep/pull/43) introduces routing,
  a separate set of `EstateReport*Response` DTOs, routing-state filtering and
  dismissal. It overlaps the report controller/service, resident report query,
  web report routes/hooks/tests, Prisma schema and generated contracts. Preserve
  routing filters and apply the dismissal rule above if it lands first.
- Neither PR's classifier supplies a Safety classification: PR #43 currently
  distinguishes EQUIPMENT_FAULT, INCONCLUSIVE and NOT_EQUIPMENT. The proposed
  manual Safety rule therefore does not depend on that classifier.
- Prefer extending a single integrated estate summary/detail response when the
  report PRs land, preserving routing and duplicate information together. Do not
  introduce a third competing response model merely for urgency.
- Generated jOOQ/OpenAPI/TypeScript files need regeneration from the final
  combined source/schema rather than choosing one branch's generated output.
- Shared-file implementation is easiest after the report PRs are integrated. If
  ID-72 starts first, keep changes focused and expect a later conflict-resolution
  and regression pass. No merges or branch-history rewrites are authorized by
  this planning note.

## Out of scope

- AI/category inference, resident-selected urgency and automatic safety detection.
- Safety notifications, timers, escalations and emergency-report prompts.
- Provider routing, duplicate matching, automatic priority increases or syncing
  report urgency with existing work orders.
- New custom-role permission codes, report lifecycle changes, bulk edits,
  configurable urgency levels or a configurable sorting engine.
- A full change-history browser or a separate history API. All real changes are
  still recorded in the database; the report detail exposes the latest one only.

## Implementation phases

1. Decisions agreed on 2026-11-07: manual Safety marking, Manager-only editing,
   four urgency levels and a latest-change display with every event retained.
2. Write and run failing HTTP/domain tests for defaults, sorting/pagination,
   safety, access, version conflicts and transactional events.
3. Apply the Prisma migration and regenerate jOOQ; implement the smallest typed
   service/repository/DTO changes that make those tests pass.
4. Regenerate the API contract; write and observe failing web tests, then add the
   badges, queue view selector, change dialog and latest-change display using shadcn components.
5. Update `.docs/api/estate-reports.md`, `.docs/frontend/estate-reports.md`,
   relevant access documentation and `.docs/README.md`. Record a decision note
   if the agreed safety/audit design warrants an architectural decision.
6. Run feature checks, `pnpm check-types`, `pnpm test`, and `pnpm fix`; verify
   generated contract consistency and manually check Manager/Crew/mobile flows.
   Leave all changes uncommitted for the human.

## Agreed decisions

- Use manual Safety marking for ID-72, since this checkout has no report-category
  classifier, and enforce Safety as Urgent above routine reports.
- Use four urgency levels, with Medium as the default.
- Give only current Managers edit authority; retain existing responder read rules.
- Keep a recorded event for each change, showing only the latest change on detail.
- Show Open reports by default and preserve All reports as the historical view.

## Initial validation notes (before ID-74 integration)

- Failing server/domain and UI tests were run before implementation. Feature
  coverage checks defaults, Safety validation/removal, current-role authority,
  inactive/foreign records, malformed bodies, stale/ABA/no-op edits, recorded
  changes, queue ordering across pages, scoped cursors, Open work-order cases,
  generated nullability, UI labels, Manager editing and conflict reloads.
- The complete Java run passed 1,650 tests. After simplifying queue reads to
  obtain urgency and cursor fields from the same query, all 139 report-related
  tests passed. Workspace type checks and the production web build passed.
- The default complete run hit 16 failures in the unchanged manual-reading
  tests: those fixtures set today's local time to 16:00, which is future at the
  current Singapore time. All 22 tests in that file and the complete 1,126-test
  web suite pass with `TZ=UTC`.
- Generation used existing local tools without installing packages. The Prisma
  migration was applied to configured development Neon; jOOQ generation used
  cached 3.21.7 because configured codegen 3.21.9 was unavailable locally. The
  configured Springdoc export plugin was unavailable locally, so the production
  app classes were booted and `/v3/api-docs` exported, then the normal Nx
  `@proj/api:openapi:types` task regenerated TypeScript. The production export
  contains no test controller. Resident API paths/contracts are unchanged.
- `pnpm fix` was attempted. Frontend/API lint and formatting pass. Configured
  Spotless 3.11.0 could not resolve its offline dependencies; the existing cached
  3.4.0 plugin applied the repository configuration and checked changed report
  files. Unrelated formatter-only edits were removed.
- A separate simultaneous-request stress test and injected storage-failure test
  were not added: version/ABA rejection and event writes have HTTP integration
  coverage, and estate serialization plus transaction enlistment reuse existing
  tested Spring/jOOQ infrastructure. No new framework/trigger behavior is
  introduced. The no-op assertion checks version/event count; timestamp
  preservation follows the same early return without any update statement.
- Routing/dismissal and duplicate integration are not tested here because
  neither feature exists on this checkout. They remain integration work for the
  respective PRs. Resident-facing urgency and a full event browser remain out of scope.
- Browser checks on 2026-11-07 used installed Windows Chrome 156 through WSL
  with an isolated temporary profile. No packages were installed. A temporary
  Vite harness loaded the actual report route components, hooks, app shell and
  stylesheet, replacing identity/API responses with in-memory fixtures. This
  initial pass validated browser presentation/interactions with fixtures; the
  subsequent authenticated live-backend pass is recorded below.
- Desktop (1440×1000), mobile (390×844 and 320×568), light/dark themes,
  keyboard Select operation, Tab containment, Escape/focus restoration,
  Open/All URL state, Safety locking, successful edits/latest-change display,
  409 reload, 503 draft retention, pending controls and Crew read-only access
  were checked in Chrome. A 720×500 CSS viewport at device scale 2 exercised
  the layout equivalent to 200% desktop zoom; browser-toolbar zoom was not used.
  The urgency dialog remained within the viewport. Desktop and Crew checks
  recorded no JavaScript errors.
- One minor existing issue remains at 320px: the shared header's estate switcher
  overlaps the theme/account controls and makes document scroll width about
  323px. The report content itself fits. Removing report content in the harness
  retains the same overflow, and the shared header is unchanged by ID-72.
  This finding is outside the urgency-screen change. Evidence and scripts are
  under `/tmp/report-urgency-browser/`, including the 320px screenshot and
  `header-baseline.json`.
- Changes remain uncommitted on `feat/report-urgency`.

### Authenticated browser verification — 2026-11-07

A second pass used the actual local web application and Spring API, with real
WorkOS authentication in two separate visible Chrome profiles. The human
completed each login; no credentials or bearer tokens were copied into the
check scripts. Calls used the application's generated client and existing token
bridge. This pass used neither fixture identity nor fixture API responses.

The Manager account could access four estates; the second account was Resident
in Test B. At the human's request, one block (`Browser check block`) and level
(`Level 1`) were created in Test B through the normal authenticated location API.
The human submitted the designated test report, titled `Testing`, through the
Resident form. Its ID is `2df5d379-6f65-4d5c-ac92-fc14b8e8c79f`.

Thirty browser assertions passed across the real empty queue/filter, report edit,
Resident authorization, and responsive visual flows:

- Authenticated list/empty states and Open/All URL state worked with the real API.
- The Manager saved Medium → High, producing version 1 and latest-change metadata.
- A second authenticated edit marked Safety/Urgent at version 2 while a dialog
  retained version 1. Saving that stale draft returned a conflict; its draft was
  retained, Save disabled, and Reload adopted the current Safety/Urgent values.
- The report was restored to Medium/non-Safety at version 3. Title, description,
  placement, images, creation time and status were preserved. A subsequent real
  no-op retained version 3 and its latest event. The three real change events
  remain as the expected audit evidence; the designated report/location data are
  retained for inspection.
- The real Resident's PATCH was rejected with 403. Their own-history detail
  returned 200 without urgency/audit fields, and its UI had no urgency action.
- Tab containment and Escape/focus restoration worked. The settled dialog fit
  desktop 1440×1000, mobile 390×844, both light/dark themes, and a 720×500 CSS
  viewport at device scale 2 (200%-equivalent layout, not browser-toolbar zoom).
  The checked mobile/zoom layouts had no horizontal overflow. No application
  JavaScript errors were recorded in the report flows.
- Independently, unauthenticated API access returned 401; the urgency PATCH CORS
  preflight admitted localhost:3001 and its normal authorization/content headers.

Scripts, results and screenshots are under `/tmp/urgency-real-browser/`. The
browser profiles and local dev processes remain available for the human to
inspect. This pass preceded integration with merged PR #54; the combined
implementation is covered in the integration validation below.

### Agreed integration and sorting update — 2026-11-07

The user authorized integration with merged PR #54 and accepted an alternate
chronological sorting control. Integrate main `a5256249640b069b2f413b8a1aa85b7adbf511bb`
without creating commits, preserving all uncommitted urgency work.

- Extend ID-74's single `EstateIssueReportSummaryResponse` / detail/page DTO family
  with urgency, Safety, version and latest-change fields. Preserve all duplicate
  metadata/actions and both explicit nullable OpenAPI unions. Remove the
  competing urgency-only estate DTO family.
- Combine duplicate and urgency permissions, service operations, shared card
  metadata and hooks. Keep Create work order unavailable for active duplicates.
  Duplicate review/link/relocation responses must retain current urgency data;
  urgency saves must retain duplicate metadata. Resident contracts stay unchanged.
- Add `sort: URGENCY | NEWEST` to the list API, default URGENCY. URGENCY remains
  Safety first, descending urgency, then creation time/ID descending. NEWEST
  orders solely by creation time/ID descending. Both apply all current filters
  before database pagination. Sorting never changes saved report values.
- Add Sort by to the existing queue filter bar: Safety and urgency (default),
  Newest first. Keep Open/All and block/level filters. All report readers can
  choose a read-only ordering; urgency writes remain Manager-only.
- URL state omits the default sort and retains NEWEST across refresh, browser
  navigation and paging. Changing sort clears the cursor; Clear filters restores
  default ordering/Open and clears location filters. Cursor scope includes sort,
  so cross-order cursors are rejected. Preserve original ordering tuple values
  from the same database result used for each page.
- Work-order source selection retains its duplicate restrictions and existing
  API defaults; it does not gain queue-only sorting controls.
- Combine Prisma schema and regenerate jOOQ/OpenAPI/TypeScript from the final
  sources. Renumber the urgency ADR to 0045 because ID-74 now owns 0044.
- Start with failing integration/sort tests, then run focused and full checks
  plus the combined UI in the existing real authenticated browser sessions.

### Integration validation — 2026-11-07

The working tree now combines ID-72 with main
`a5256249640b069b2f413b8a1aa85b7adbf511bb` (merged duplicate-report PR #54).
`feat/report-urgency` was advanced to that existing commit with all feature files
preserved uncommitted. Original and combined file backups are under
`/tmp/urgency-integration/`. No feature commit, merge, rebase or push was made.
Incoming main files outside the agreed integration changes match the fetched
snapshot.

- Four new HTTP regressions were seen failing before implementation: NEWEST
  ordering across pages with filters/time ties, rejecting cross-sort cursors,
  rejecting unknown sorts, and retaining duplicate/urgency fields across both
  mutations. Two new UI sort tests were also seen failing before implementation.
- Focused combined report HTTP coverage passed 181 tests. A new UI pagination
  test was corrected separately to await the visible Previous page button after
  navigation; its existing ordering/URL assertions were retained. The sorting
  subset then passed 11 tests, including both new queue tests.
- Final full `pnpm test --skip-nx-cache --output-style=static` passed 1,759 Java
  tests and 1,146 web tests, with no failures, errors or skipped tests. The first
  full run had a disposable Postgres connection refusal in the unchanged
  estate-role group; all 80 tests in that group passed independently with a fresh
  database. The full rerun used the default Spring context cache size of 32,
  offline Maven, a 1.5 GB JVM heap and `TZ=Asia/Singapore`.
- `pnpm check-types`, `pnpm fix`, `pnpm check` and the production web build passed.
  No dependency declarations were changed.
- Applied the pending main duplicate migration to the configured development
  database and regenerated Prisma/jOOQ with the existing cached code generator.
  The combined schema and generated sources contain both duplicate links and
  urgency events. The existing urgency migration remains additive.
- Attempted the normal `pnpm api:generate` workflow; the configured Springdoc
  Maven export plugin is unavailable offline. Exported `/v3/api-docs` from the
  real running production application classes instead, then ran the normal Nx
  `@proj/api:openapi:types` task. The resulting contract has one combined estate
  DTO family, both explicit nullable object unions, and the two-value sort
  parameter. Resident report DTOs match main exactly; no test endpoint is exposed.
- In the existing authenticated Resident Chrome profile, the agent submitted
  `Urgency integration check` through the real report form into Test B, using
  Browser check block / Level 1. The new report ID is
  `8c1c0782-1dfd-42ff-af15-c3501b288db4`. This fixture is retained for review.
- After the human renewed sign-in, 31 authenticated live-browser assertions
  passed across Resident submission, Manager sorting/editing, Crew reads and final
  fixture restoration. No identity/API fixtures or manually copied bearer tokens
  were used. The checks verified both actual database sort orders, the default
  UI order, Newest URL/render order, All/Open preservation, reload/browser-back,
  Clear filters, read-only sorting, unchanged Resident DTOs and Resident PATCH
  denial. Desktop 1440×1000 and mobile 390×844 screenshots were inspected; the
  mobile queue had no horizontal overflow. Queue/detail checks recorded no
  JavaScript errors.
- Manual duplicate linking returned current urgency data. Saving High through
  the real urgency dialog retained the confirmed link and its restricted
  Create work order action. Selecting Not a duplicate preserved High and the
  latest-change metadata and restored Create work order. Both reports were then
  restored to Medium/non-Safety, with no active duplicate links/counts, and the
  refreshed queue showed those values. The original report is urgency version 7;
  the new fixture is version 2. Expected change events and the rejected test link
  remain as audit evidence; neither report was deleted.
- Scripts, results and screenshots are under `/tmp/urgency-real-browser/` and
  `/tmp/urgency-integration/`. Local dev servers and both Chrome profiles remain
  available; the Manager window shows the restored queue. All feature changes
  remain uncommitted for human review.

### Agreed Oldest first addition — 2026-11-07

The user accepted adding Oldest first as the third queue ordering. Keep Safety
and urgency as the default. Add `sort=OLDEST` to the existing API and shadcn
selector. It orders solely by submission `createdAt ASC, id ASC`, ignoring
urgency/Safety. Apply existing Open/All and location filters before database
pagination, using an ascending cursor comparison and the existing sort-scoped
cursor. Preserve OLDEST through URL reload/navigation/paging; changing order
clears the cursor and Clear filters restores the default. Use typed jOOQ only,
regenerate the API contract, and cover ordering/ties/filtering/cursor scope plus
UI selection/URL/pagination with failing tests before implementation. No schema
change or new dependency is needed.


### Oldest first validation — 2026-11-07

- The new oldest-first HTTP test failed with 400 before implementation; both new
  UI tests failed for the missing option/unsupported URL. The same tests pass
  after adding OLDEST, ascending time/ID ordering and its cursor comparison.
- Coverage includes equal timestamps, ignoring urgency/Safety for chronological
  ordering, Open-only exclusion of all-closed reports, location/range filters,
  complete ascending pagination, and rejecting an OLDEST cursor in other sorts.
  UI coverage checks selecting the option, retaining All/location filters,
  resetting the cursor, restoring URL state, paging and Clear filters.
- Full offline workspace regression passed 1,760 backend tests and 1,148 frontend
  tests. Type checks, formatting/lint and the frontend production build passed.
  Logs are `/tmp/urgency-integration/oldest-*.log`.
- The expanded enum/description were exported from the real running API and
  generated using the normal API type task, with the same documented fallback
  for the unavailable offline Springdoc Maven export plugin. The final contract
  defaults to URGENCY and accepts URGENCY/NEWEST/OLDEST. Resident DTOs are unchanged.
- The earlier SQL cleanup replaced all ten handwritten SQL calls in the urgency
  integration tests with generated-table jOOQ operations. Existing assertions
  stayed unchanged and all 22 then-current tests passed before and after cleanup;
  the additional oldest-first test now brings that suite to 23. No handwritten
  test SQL was added for this addition. Prisma migrations remain unchanged.
- No additional live browser pass was completed for Oldest first: the existing
  Chrome debugging session was unavailable. The 31 authenticated browser checks
  recorded above predate this option; the new controls/URL behavior were checked
  through the route UI tests and production build. Changes remain uncommitted.


### Pagination recovery fix — 2026-11-07

The user authorized fixing recovery from rejected/outdated report-page cursors.
HTTP 400 with a cursor now offers Return to first page through the existing
ErrorState/shadcn button. It invokes the existing first-page navigation, keeping
Open/All, block/range and sort while dropping the cursor. Other errors and errors
without a cursor retain Retry. No backend/API/schema change is needed.

Before implementation, three regressions (URGENCY, NEWEST, OLDEST) failed because
Return to first page was absent. Negative cases cover transient cursor failures
and HTTP 400 without a cursor. Urgency assignment itself remains unchanged:
Medium/non-Safety is the automatic default, with Manager-only manual escalation;
there is no automatic classification or separate reviewed/unreviewed marker.


Pagination recovery validation: all five new route tests pass, including all
three sorting modes and both ordinary-Retry cases. The full frontend suite
passes 1,153 tests; workspace type checks, frontend lint/format and production
build pass. Backend sources and contract are unchanged from the previous full
1,760-test backend pass. No extra browser check was claimed. Logs are under
`/tmp/urgency-pagination-fix/`; changes remain uncommitted.
