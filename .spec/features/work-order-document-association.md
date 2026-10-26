# Work-order document association (ID-26)

**Status:** agreed association slice implemented with TDD on 2026-10-25; isolated
live QA and real Neon/R2 checks completed on 2026-10-26. Database/bucket cleanup
coordination and ID-23/24/25 integrations remain.
**Owner:** Chan Ding Jie
**Branch:** `feat/work-order-document-association`
**Dependency base:** `origin/feat/invoice-service-report-ID22` at
`1a30a3f6822d2a121d9436f884a59d18fd9dab5f`,
[ID-22 PR #37](https://github.com/notsql/Upkeep/pull/37).

Sources: [ID-26](https://notjira.atlassian.net/browse/ID-26),
[ID-22](https://notjira.atlassian.net/browse/ID-22),
[ID-23](https://notjira.atlassian.net/browse/ID-23),
[ID-24](https://notjira.atlassian.net/browse/ID-24),
[ID-25](https://notjira.atlassian.net/browse/ID-25).

The user agreed the product defaults, correction/removal, permission intersection
and linked-file deletion policy before implementation. Once the published ID-22
code was available, the user authorized starting this dependent implementation.
ID-22 PR #37 is now merged (verified on 2026-10-26), at merge commit
`1ffde3a776d68d289802d972416b38db9d2b1fee`. Its final head was `b590658`, which
also incorporated main's device-status work. Comparing that head with this branch's
`1a30a3f` base showed no additional document model/storage implementation changes.
This local branch still needs integration with the newer merged main before final
merge; generated contracts and SecurityConfig overlap and must be preserved and
reverified. The current passing tests describe the local branch before that integration.

## Problem and current scope

Work orders support progress, completion and audited outcome corrections, but
cannot show the invoices/service reports supporting a contractor's work. Associate
an existing stored document with a job, including a Closed or historical job.
Correct mistaken associations without losing the file or earlier link history.

Reuse ID-22's real Document model, permissions, generated DTOs, upload/list,
private authenticated download and deletion. Do not create a parallel upload,
storage or document-detail implementation. Linking does not wait for OCR or
verification, and does not claim that an upload has been reviewed.

## Agreed behaviour

1. One document links to at most one same-estate work order; many documents can
   link to a job. Open, In Progress and Closed orders are eligible. A historical
   job's moved/retired asset or inactive location does not invalidate the link.
2. Reads require both current work-order read access and VIEW_DOCUMENTS. Permitted
   Crew can read attachments and association history. Council/custom roles with
   document access alone gain no work-order search/detail/history access. Work-order
   readers without document permission see no document metadata or file bytes.
3. Link/change/remove require current active-estate Owner/Manager authority and
   EDIT_DOCUMENTS. Non-owner Managers are included without asset-register access.
   Crew document-edit/uploader rights alone grant no association-write authority.
   Resident override and live membership rules apply. Inactive estates retain reads.
4. A committed ID-22 Document with deletedAt null represents an available upload.
   Missing, foreign-estate or deleted documents/orders cannot be linked. No fictional
   upload state is added. Extraction/verification is not a linking prerequisite.
5. Changing or removing an existing link requires a nonblank correction reason,
   trimmed and at most 500 characters. Initial links need no reason. Removal clears
   only the work-order relation; the uploaded document remains available.
6. Save uses the association version the user reviewed. A stale version returns
   409, including replay of an earlier successful request. An unchanged target with
   the current version is a no-op with no additional event. There are no automatic
   mutation retries. Explicit null removes a link; omitting workOrderId returns 400.
7. Append an initial/change/remove audit event with previous/new targets, actor,
   optional display-name snapshot, server timestamp, reason and association version.
   Save relation/version/event atomically. No event edit/delete API is introduced.
8. Linked documents remain deletable under ID-22's policy: current EDIT_DOCUMENTS
   plus uploader or Owner/Manager authority. Hide deleted documents from current
   attachments, association/history and content access; retain internal row/link/audit.
   Physical R2 cleanup remains ID-22's responsibility. No restore/archive UI is added.
9. Linking, correction, removal and document deletion preserve work-order
   status/version, completion/outcome/costs, transition/revision audit, source report,
   asset condition and canonical maintenance entries. Never auto-close/reopen a job,
   import invoice costs, overwrite reviewed completion fields or count a repair twice.

## Dependencies deliberately deferred

| Story | Integration boundary |
| --- | --- |
| ID-22 upload/storage | PR #37 merged; local branch uses its earlier implementation commit and still needs the newer main integration before final merge |
| ID-23 extraction | Display actual extracted findings/parts when provided; no placeholder extraction records or fabricated data |
| ID-24 verification | Follow actual reviewed-data visibility/fields later; linking itself requires no verification |
| ID-25 asset association | Agreed rule: reject when both document/order have different non-null asset IDs; allow either absent, never silently reassign. ID-22 has no document asset field, so enforce/test this only when the real ID-25 relation exists, including later asset reassignment |
| ID-27 / ID-29 | Document timeline/orphan queue are separate; integrate their invalidations only when present |

Provider assignment (ID-37) is not required. This association slice does not claim
all future extracted/reviewed-data acceptance criteria are complete.

## Data and transaction design

Prisma owns additive migration
`20261025132716_work_order_document_association`; ID-22's migration is unchanged.

- Add nullable Document.workOrderId and workOrderAssociationVersion (integer,
  default 0), composite foreign key to WorkOrder(id, estateId), Document unique
  (id, estateId), and an attachment-list index.
- Add DocumentWorkOrderEvent with document/estate, nullable previous/new order IDs,
  positive associationVersion, optional initial-link/required correction reason,
  actor subject/display-name snapshot and changedAt. Unique document/version and
  same-estate composite foreign keys prevent cross-estate audit/relations.
- Database checks require a real target change, valid versions and a nonblank
  reason when the previous target exists. Audit is append-only through the API.
- Writes lock estate then document, matching ID-22 deletion. Recheck current
  permissions/lifecycle in the transaction and reject stale versions under the
  document lock. Event insertion and relation/version update share that transaction.
- Resolve the optional actor display name before the write transaction. Missing
  names render as Name unavailable; never expose WorkOS subjects/storage keys.
- Regenerate Prisma and jOOQ from the migrated disposable database. Never hand-edit
  generated database classes or make Spring migrate the schema.

Decision: [0037](../decisions/0037-audited-work-order-document-associations.md).

## API

All new endpoints require identity, including local open-security mode, and use
private/no-store responses with real typed DTOs. Generate OpenAPI/TypeScript from
actual controllers, never hand-write frontend API shapes.

| Method | Path | Request | Success / authority |
| --- | --- | --- | --- |
| GET | `/estates/{estateId}/documents/{documentId}/work-order` | UUID path parameters | 200 current link/version/last change, including unlinked state; both read authorities |
| PUT | same | required nullable workOrderId, required nonnegative integer expectedAssociationVersion, optional correctionReason | 200 current link; active Owner/Manager plus document edit |
| GET | `/estates/{estateId}/documents/{documentId}/work-order/history` | optional cursor and limit 1–100, default 25 | 200 chronological association-event page; both read authorities |
| GET | `/estates/{estateId}/work-orders/{workOrderId}/documents` | optional cursor and limit 1–100, default 25 | 200 shared DocumentPageResponse of nondeleted attachments, newest upload first; both read authorities |

Reuse the existing work-order list API for partial-reference/status search and
pagination. All statuses includes Closed. Reuse ID-22 content retrieval unchanged.
Cursors are bound to kind/estate/document or work order. Preserve 400 validation,
401 missing identity, 403 denied role/permission, 404 inaccessible/missing records,
409 inactive write/stale version, and safe 500 persistence errors.

Detailed contract: [.docs/api/work-order-documents.md](../../.docs/api/work-order-documents.md).

## Frontend flow and recovery

- Add a Work order action to ID-22 Documents rows for users with both read
  capabilities. A route-local shadcn Dialog shows current link and paginated audit.
- Only authorized writers get the searchable paginated Table picker and change/
  remove actions. Show reference, description, status and saved location. Selection
  survives search/page changes; Cancel does not mutate. Removal names the current
  job and explains the file remains available, with explicit confirmation/reason.
- Capture prior target/version when editing starts. Background refresh never
  silently updates the reviewed draft. Disable pending saves/close and guard
  repeated submission immediately.
- Retain draft/reason on error. Validation 400 remains directly correctable.
  Conflicts or uncertain responses require refresh of link and history followed
  by I reviewed the updated link; refresh never auto-submits or discards the draft.
  Lost responses explain that the save could not be confirmed. Read failures offer
  retry; denied/deleted responses suppress stale private metadata.
- Work-order detail adds a Documents Card/Table with type, filename, upload time,
  authenticated Download, empty/loading/error/retry and pagination. No fabricated
  findings or reviewed fields are displayed.
- Feature hooks use generated client/DTOs and user-prefixed React Query keys under
  `[userId, "documents", estateId]`, matching ID-22 upload/delete invalidation.
  Successful saves seed current association and invalidate its history plus both
  former/new job attachment pages. Scope component state to user/estate/document
  or job; preserve existing session isolation. Do not invalidate unchanged job costs.
- Use shared shadcn components, folder routes and small route-local components.
  Long filenames must wrap without widening the dialog. Mobile table scrolling,
  landscape footer access, light/dark feedback and keyboard focus remain usable.

Built screen/hook inventory and manual steps:
[.docs/frontend/work-order-documents.md](../../.docs/frontend/work-order-documents.md).

## Verification and remaining review

- [x] Product decisions/spec agreed before implementation; architecture/testing rules read.
- [x] Preserve plan and base branch on published ID-22 commit without committing.
- [x] Observe failing server tests before implementing association routes/authorization;
  separately observe missing-target regression fail before making that key required.
- [x] Cover Closed jobs, non-owner Managers, Crew reads, denied document-only/
  Resident writes/reads, cross-estate/missing/deleted records, inactive estate,
  corrections/removal, pagination, no-op/replay, concurrent selections and rollback.
  Verify work-order/completion records are unchanged and deletion retains audit.
- [x] Observe failing web tests before adding picker, correction/removal, conflict
  recovery, attachments, validation correction and uncertain-save feedback.
- [x] Apply migration and regenerate Prisma/jOOQ only against disposable Postgres;
  no shared Neon database changes. Run Maven offline without installing tools.
- [x] Latest full suite passed: 1,209 backend tests and 666 web tests; types, formatting,
  lint and production web build passed. Generated contract uses real controllers.
- [x] Chrome component checks with actual React/shadcn/application CSS and temporary
  API/access fixtures: Closed selection/save, reasoned removal, conflict with retained
  draft and explicit refresh/review, Crew read-only audit, Escape/focus return,
  320/390px portrait and landscape scrolling, light/dark, long filenames and unbroken correction reasons.
  Observed overflow before constraining the dialog grid/wrapping audit text; rechecked
  bounds. Added a failing regression before correcting raw status labels.
- [x] Live authenticated review with an actual uploaded file: ID-22 upload/download/
  deletion, correction/removal, two-tab conflict recovery, role UI/API checks and
  mobile/keyboard. Real AuthKit and disposable Postgres were used with local S3-compatible
  storage; see the frontend QA record for results.
- [x] Verify the Cloudflare R2 provider using the user's already running app and
  migrated Neon dev branch: real PDF uploads/downloads match original bytes, PNG
  upload/deletion checked with R2 HEAD 200 then 404, outcomes/costs unchanged.
  Keep labelled demo work orders/PDFs for the user to inspect.
- [ ] Coordinate database/bucket isolation for ID-22 cleanup: three pre-existing
  R2 objects were absent from this Neon branch, though none was yet 24 hours old.
  The existing orphan sweep can remove another branch's valid files if a bucket
  is shared without a common metadata registry. Resolve the setup/ownership policy
  before a cleanup change; do not silently alter another story during QA.
- [x] Verify ID-22 PR #37 merge and compare its final head with the implementation
  base. New intervening work is primarily device status; document storage/model
  behaviour is unchanged in that comparison.
- [ ] Integrate the newer main into this local branch and rerun relevant checks
  before final merge. Human handles commits/integration commands, push and PR.
  Current feature work can be pushed for review after the human commits it.
  Coordinate any shared database deployment separately.
- [ ] Integrate real ID-23/24 reviewed fields and ID-25 asset consistency when available.


## Approved sidebar sizing fix (2026-10-26)

The user reported that long estate names push the estate selector beyond the
sidebar's padded width. A browser probe reproduced this without renaming records:
a 70-character name widened the trigger to about 522px inside a 199px column;
200 unbroken characters widened it to about 1,942px. The demo estate name also
expands the control. Existing inner truncation cannot work while the parent grid
track is allowed to grow with its content. A temporary inspector-only
`minmax(0, 1fr)` column constrained the demo trigger to the available 199px; the
inspector changes were restored and no UI source was changed.

The user approved the following fix/review scope before implementation:

- Bound the sidebar navigation grid and selector to the available padded width;
  allow the grid/flex children to shrink rather than enlarging the sidebar content.
- Truncate the selected estate name and long custom-role label while preserving
  full accessible names/descriptions. Keep the icon and chevron visible. Ensure
  the opened menu can show the full name within viewport bounds.
- First record a failing browser layout regression, then make the smallest UI
  change. Check the actual demo name, long spaced/unbroken names and long custom
  roles on desktop; recheck the mobile estate selector and keyboard navigation.
- Implemented after user agreement and a failing browser layout assertion. The
  previous QA missed this case; the new regression confirms 200 unbroken characters
  fit the 199px column with truncation after the fix.


## Agreed Resident estate-switching change (2026-10-26)

Current behaviour is intentional: EstateFeatureSwitcher always sends a selected
RESIDENT estate to `/reports/new?estateId=...`, including when switching from
Crew work orders or Documents. Residents do not gain work-order/document access.
The user found the automatic jump into a creation form surprising and asked for
an alternative destination. This is an agreed navigation UX change; it grants no additional permissions.

The user approved this flow and the sidebar sizing fix before implementation:

- Keep all relevant estates and role labels in the shared switcher. Stay on the
  current feature when the selected estate permits it.
- When switching from a list/browsing feature to a Resident estate, open My reports
  scoped to that estate. Show the selected estate/Resident role and make the
  destination clear in the menu, such as Resident · My reports.
- Use the existing Report a fault action for explicit creation, preselecting the
  chosen estate. An empty resident history shows a clear empty state and that action.
- Preserve explicit Report a fault intent when changing estates inside its form;
  that action continues to select the estate on the form rather than sending the
  user back to history. Direct forbidden work-order/document URLs still show
  Page not found.
- My reports currently has no estate-filtered API/query: `/resident/reports` only
  accepts cursor/limit and lists the caller's history across estates. Add optional
  estate filtering on the server before pagination; keep
  authenticated ownership/history-after-membership-removal rules unchanged. Bind
  cursors to the filter and reset client pagination/query state on estate changes.
  Do not filter a single already-paginated page in the browser.
- Specify/agree that cross-app API change before implementing it. Start with
  failing tests for Crew work orders/Documents to Resident history, preservation
  of explicit creation intent, correct estate filtering/pagination, ownership
  protection and returning to an estate that permits work orders/Documents.
  Regenerate the contract and update the resident-report docs with implementation.

Implemented with observed failing tests before code: server estate/ownership
filtering, cursor-scope validation, navigation intent, estate/user pagination reset,
scoped detail/return links, and the unavailable-reporting/history distinction.
Live browser checks confirm Crew work orders/Documents open the selected Resident
history and explicit creation retains the estate/form. Full verification passed with 1,209 backend and 666 web tests, type checks,
formatting/lint and production web build. No additional migrations are needed.
A further observed long-name overflow in the new history header was fixed with
wrapping and rechecked at 320px. Unavailable reporting disables only explicit
creation choices; owned history remains selectable/readable.

The normal `pnpm api:generate` export could not use its uncached declared springdoc
Maven plugin offline. Instead, booted the actual Spring app against disposable
Postgres, exported `/v3/api-docs`, and ran installed Nx `@proj/api:openapi:types`.
No generated contract was hand-written, no dependencies downloaded, and no shared
migration applied. Update the matching `.docs/` API/frontend files and index with
implementation; retain the verification limits above when reporting readiness.
