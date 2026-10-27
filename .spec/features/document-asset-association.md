# Link and unlink documents on assets

**Status:** implemented and automated verification passed on 2026-10-27; manual browser acceptance pending
**Owner:** unassigned

## Problem

An uploaded document can remain detached from the equipment it concerns. Users
need to select an asset from their estate's unified asset record, link the
existing document to it, find the document on that asset afterward, and remove
an incorrect or unnecessary association without deleting the file.

Updated user story: “As a user with asset-editing access, I want to link an
uploaded document to a specific asset in the unified asset record, and unlink
it when needed, so the document is associated with the equipment it concerns.”

Acceptance criteria:

1. The interface provides a searchable and filterable list of all items within
   the estate's unified asset record, including retired assets.
2. Saving associates the existing document UUID with the selected asset's
   database entry, and the association survives refresh.
3. Users with asset-editing access can link and unlink documents, including on
   retired assets. Document-edit permission is not an additional requirement.
4. Unlinking removes only the document/asset association. The uploaded file and
   any existing work-order association remain available under their own policies.
5. Linking requires an available uploaded document. Extraction and verification
   are not prerequisites and are not part of this story.

## Confirmed scope and current system

The user confirmed asset-editing authority for both actions, retired-asset
eligibility, unlinking, and removal of extraction/verification requirements on
2026-10-27. The user approved implementation against the tests on the same day.
The API, migration, generated contracts and browser UI are implemented as below;
the as-built contracts are in `.docs/api/asset-documents.md` and
`.docs/frontend/asset-documents.md`.

- [Document uploads](invoice-service-report-uploads.md) already provide estate
  document metadata, private downloads, permissions and durable deletion.
  `Document.id` identifies a committed upload; `deletedAt` marks removal.
- The register already exposes `q`, `category`, `locationId`, `condition` and
  `status` filters through `GET /estates/{estateId}/assets`. It returns the
  complete filtered array and currently requires estate ownership.
- Ordinary asset editing is currently owner-only. Use that same estate-level
  authorization for associations, rather than hard-coding another role list or
  adding a new document permission. Manager/Crew inspection access or document
  editing alone does not grant asset-editing authority.
- Retired assets normally block ordinary equipment-field edits. Association
  actions are an explicit exception: evaluate the caller's estate-level
  asset-editing authority without rejecting the target for being retired.
- [Work-order association](work-order-document-association.md) already links
  documents to jobs. Its agreed integration rule rejects different non-null
  document/work-order asset IDs while allowing either asset ID to be absent.
- This feature depends on existing upload/storage and assets, and integrates
  with existing work-order links. It has no ID-23/24 extraction or verification
  dependency and adds no extracted-data fields or verification state.

## Behaviour

1. A user with current asset-editing authority can link an available same-estate
   uploaded document. Linking and unlinking require no separate `EDIT_DOCUMENTS`
   grant and do not depend on who uploaded the file.
2. The picker is scoped to the document's estate and initially shows all assets
   (`status=ALL`), with retired assets clearly labelled and selectable. Both
   linking and unlinking are allowed on retired assets. Inactive estates retain
   reads but block association writes, following existing estate lifecycle policy.
3. Search matches partial names or references case-insensitively and literally.
   Filters support category, location including descendants, condition (`GOOD`,
   `NEEDS_ATTENTION`, `FAULTY`, `UNASSESSED`) and status (`ACTIVE`, `INACTIVE`,
   `ALL`). Search and filters combine with AND in the database; clearing them
   restores the complete estate register.
4. Each result shows a leftmost selection checkbox, reference, name, category,
   full location path and active/retired status. The assessment/condition display
   column is omitted. One checkbox can be selected at a time; unchecking it clears
   the selection. The action and dialog are labelled “Associate Asset”, as requested
   in the follow-up UI change. Selection uses the asset UUID. Search/filter changes
   retain a clearly displayed selection until it is changed or cleared.
5. Linking requires explicit Save after selection. Confirmation identifies the
   document filename and selected asset reference/name. Cancel makes no change;
   Save is disabled without a selection and during a pending request.
6. One document links to at most one asset; an asset can have many documents.
   Linking preserves the document UUID, original file and metadata. The document
   shows its linked asset, and the asset's Documents section lists the document.
   Both views reflect the association after a full page reload.
   The Documents table has an Asset column: an unlinked document shows
   Associate Asset for asset editors, while a linked document shows its asset
   reference/name as a detail-page link. Unlink opens confirmation directly,
   identifying the document and asset and retaining the reviewed association
   version. Cancel leaves the link untouched. Loading and read errors do not
   display an unlinked state; users without asset-read authority see no
   association metadata.
7. An asset editor can choose Unlink from either the document association UI or
   the asset's Documents section. Confirmation identifies the document and asset
   and explains that the file is retained. Cancel makes no request. Confirming
   clears only `Document.assetId`; it does not delete or re-upload anything,
   remove a work-order link, or change equipment fields.
8. To move a document to another asset, explicitly unlink it and then link it to
   the new asset. Directly replacing a non-null link with a different asset
   returns 409, preserving the original association. No correction reason is
   required for linking or unlinking in this scope.
9. Writes use the association version the user reviewed. A stale version returns
   409, including a delayed unlink after another tab has changed the link. With
   the current version, saving the same target or unlinking an already unlinked
   document is a no-op. Real changes increment the version atomically.
10. The server rechecks current permissions, estate activity, document
    availability, target existence and estate scope within the transaction.
    Deleted/missing/foreign documents or assets cannot be linked. Retirement
    alone must not reject either association action.
11. If the document's linked work order has a different non-null asset ID,
    linking returns 409 without changing either association. Apply the same
    check to work-order association writes so reverse-order/concurrent linking
    cannot create a mismatch. A work order with no asset remains valid; linking
    never assigns one automatically. Unlinking the document from its asset
    leaves the work-order link untouched.
12. Existing document read/download and upload/deletion policies remain in
    force. Only show document metadata or file actions to callers allowed to
    read them; those read checks do not introduce a separate document-edit gate
    for association mutations. Document edit/uploader rights alone grant no
    asset access.
13. Linking/unlinking changes no condition, retirement metadata, maintenance/cost
    entry, work-order status or completion. Moving/retiring the asset preserves
    its documents by UUID. Document deletion hides it from current attachments
    and content access under the existing policy while retaining the internal row.

## Data

Use an additive Prisma migration in
`packages/db/prisma/schema/schema.prisma`:

- Add nullable `Document.assetId: UUID`, initially null for existing documents.
- Add `Document.asset` with a composite foreign key `(assetId, estateId)` to
  `Asset(id, estateId)`, using restrictive deletion/update rules consistent with
  the existing document/work-order relation.
- Add inverse `Asset.documents` and index
  `Document(estateId, assetId, createdAt, id)` for attachment reads.
- Add `Document.assetAssociationVersion: integer`, default 0, for concurrent
  linking/unlinking. Keep it independent of `workOrderAssociationVersion`.
- Record the latest real association change using nullable
  `assetAssociationChangedByUserId` and `assetAssociationChangedAt`. Set them
  atomically with the relation/version for both link and unlink; no-ops preserve
  them. Do not expose identity subjects in public DTOs.

The foreign key makes the existing document part of the asset record; no file
bytes, extracted data or document metadata are copied into `Asset`.

Follow existing estate-first locking, then lock the document and validate
related records. Asset-link and work-order-link writes must serialize on the
same estate lock and follow a common additional lock order. Check the reviewed
version under the lock. Persist relation, version and change attribution in one
transaction. A failed transaction preserves the previous link. No R2 write or
physical file removal is needed for either action.

Regenerate Prisma and jOOQ after migration; never edit generated sources. Keep
this additive migration compatible with the previous application version.

## API

| Method | Path | Request | Success | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/assets` | Existing optional `q`, `category`, `locationId`, `condition`, `status`; picker starts with `ALL` | 200 existing `AssetResponse[]` | Existing asset-register read authority |
| GET | `/estates/{estateId}/documents/{documentId}/asset` | UUID path parameters | 200 `DocumentAssetResponse`, including unlinked state | Existing asset read + document read authority |
| PUT | `/estates/{estateId}/documents/{documentId}/asset` | `ChangeDocumentAssetRequest` | 200 `DocumentAssetResponse` | Current asset-editing authority; active estate; retired asset allowed |
| GET | `/estates/{estateId}/assets/{assetId}/documents` | Optional opaque `cursor`; `limit` integer 1–100, default 25 | 200 existing `DocumentPageResponse` | Existing asset read + document read authority; inactive history allowed |

`ChangeDocumentAssetRequest`:

- `assetId: UUID | null`, required key: a UUID links; explicit null unlinks.
  Omission returns 400 to prevent accidental removal.
- `expectedAssociationVersion: integer >= 0`, required. Reject malformed or
  fractional versions rather than coercing them.

`DocumentAssetResponse`:

- Required `documentId: UUID`, `associationVersion: integer`.
- Required nullable `assetId: UUID`, `assetReference: string`, `assetName: string`.
- Required nullable `changedAt: ISO-8601 timestamp`; initially null, retained
  after an unlink as the latest association change time.

Attachment reads reuse existing `DocumentResponse` metadata and
`DocumentPageResponse { items: DocumentResponse[], nextCursor: string | null }`.
Exclude deleted documents, sort newest upload first with UUID tie-breaking, and
bind cursors to the estate/asset. Reuse the authenticated content endpoint for
file downloads. No extraction/verification DTOs are added.

New endpoints require identity even in local open-security mode. Use private,
no-store responses and safe `EstateError` messages. Document 400 for invalid
UUID/body/version/cursor/limit, 401 for missing identity, 403 for denied authority,
404 for inaccessible estate or missing/foreign/deleted records, 409 for inactive
writes, stale version, attempted direct reassignment or conflicting work-order
asset, and 500 for persistence failure. Preserve existing asset endpoint error
semantics. Do not return a verification error for an available uploaded document.

Use real Java DTO records and regenerate `packages/api/openapi.json` and
`packages/api/src/schema.ts` through `pnpm api:generate`. Frontend hooks consume
only the generated client and types.

## Frontend

- Extend the folder route
  `apps/web/src/routes/_auth/estates/$estateId/documents/index.tsx` with a
  route-local `-components/document-asset-dialog.tsx`. Use shared shadcn Dialog,
  Input, Select, Table, Button, Field and Alert components. Reuse existing asset
  filters where practical without generalizing unrelated screens.
- Show current association when opening the dialog. Asset editors see Link when
  unlinked and Unlink when linked. On the asset detail page, add a route-local
  `-components/asset-documents-section.tsx` with filename, document type, upload
  date, authorized Download and an Unlink action for asset editors.
- Derive association mutation capability from the same live estate authority as
  asset editing, combined with estate activity. Do not reuse an action flag that
  disables ordinary field edits on retired assets. Keep file-read/download gates
  separate and hide mutation actions from callers lacking asset-editing access.
- Put new hooks in `apps/web/src/lib/asset-documents.ts`, using user-prefixed keys
  under `[userId, "documents", estateId]` for associations/attachments. Reuse
  `useAssets` and its existing account/estate/filter-scoped keys for the picker.
- Capture the current version when a link or unlink confirmation opens. Do not
  silently update that reviewed version from a background refresh. Disable
  duplicate submissions while pending and perform no automatic mutation retries.
- On confirmed success, seed the association query and invalidate estate document
  queries, including former/new asset attachment pages. Announce the appropriate
  linked/unlinked result. Do not invalidate unrelated condition/cost data.
- Retain selection or unlink intent after a correctable error. For 409 or an
  uncertain network result, refresh the association and require explicit review
  before resubmitting. If another tab linked a different asset, do not silently
  retarget the pending unlink. Read failures offer Retry without auto-submission.
- Reset state on account/estate/document changes. Suppress stale private metadata
  after revocation/deletion. Distinguish loading, failure, empty register, no
  filter matches and no linked documents. Verify labelled inputs, keyboard
  selection/focus return, narrow screens, long filenames and light/dark themes.

## Edge cases

- Identically named assets remain distinguishable by reference/location; only
  the selected UUID is saved. Literal `%`/`_` follow existing search rules.
- Foreign-estate targets/filters cannot expose or modify another estate's data.
- Two concurrent links to different assets yield one success and one stale 409.
  A delayed unlink cannot clear a newer link after an unlink/relink sequence.
- Same-target saves and repeated unlinks with the current version create no
  duplicate change; stale retries return 409 and can be reconciled through GET.
- Permission revocation, estate deactivation or document deletion between opening
  and saving is caught in the transaction. Retirement does not block the action.
- Both work-order linking orders preserve asset consistency; unlinking never
  removes the existing work-order relation or counts a repair/cost twice.
- A failed unlink leaves the prior link intact. A lost response is resolved by
  refreshing the current association before another explicit submission.
- R2 availability affects download through its existing error path, independently
  of the database-only link/unlink actions.

## Test-first coverage

The regression tests exercise existing routes and HTTP JSON, so missing feature
behaviour fails through assertions rather than missing component/DTO imports.
Server fixtures use real uploads against the local R2 stub and disposable,
Prisma-migrated Testcontainers Postgres; no shared estate data is modified.

| Planned behaviour | Coverage |
| --- | --- |
| Ordinary uploads, durable UUID links, asset attachment reads and downloads (1, 5–6) | `AssetDocumentsIntegrationTests`; web `documents/asset-association.test.tsx` and `assets/$assetId/-components/asset-documents-section.test.tsx` |
| Search/filter combinations, descendant locations, literal search, retired results and UUID selection (2–4) | Existing `AssetLifecycleIntegrationTests` covers register SQL/filter semantics; new web association tests cover picker defaults, all filters, duplicate asset names, retained selection, loading and empty/no-match states |
| Confirmation, cancellation, unlink, retained upload/work order and explicit reassignment (5, 7–8) | New server and both web suites |
| Required nullable target, malformed versions/paths/cursors/limits, no-ops, reviewed versions and concurrent edits (9) | New server suite; web association tests cover pending submissions, background refresh, conflict review and uncertain-response recovery |
| Current ownership, inactive estates, deleted/missing/foreign records and retirement exception (10) | New server suite; web suites cover current permission revocation, historical reads and retired-asset unlink |
| Both linking orders, matching/absent work-order assets and concurrent mismatch prevention (11) | New server suite; unlink also asserts the work-order association version and work-order record are unchanged |
| Asset authority and document-read intersection, private responses and mandatory local identity (12) | New server suites; web suites cover a document-editing Manager without asset authority, revoked document reads and account/estate isolation |
| Unchanged asset fields/events, relocation/retirement persistence, deletion visibility and independent R2 outages (13) | New server suite |
| Attachment pagination, metadata and document-list invalidation | New server and web suites |

Server tests live under `apps/server/src/test/java/com/proj/server/` in
`AssetDocumentsIntegrationTests.java` and
`AssetDocumentLocalSecurityIntegrationTests.java`. Web tests live under
`apps/web/tests/routes/_auth/estates/$estateId/`, using the shared test-only
HTTP/session fixture `apps/web/tests/fixtures/asset-documents.tsx`.

Current asset editors are owners, whose document permissions are implicit, so
there is no real server identity with asset-edit authority but no document-edit
permission to seed. The web suite explicitly exercises that permission
projection without introducing a new role or permission.

Keyboard-only interaction/focus return, narrow screens, long filename layout
and light/dark appearance still require the manual checks below: jsdom does
not verify real browser layout or visual appearance. Download storage failures
remain covered by the existing upload/download tests; the new outage test
checks that association writes themselves do not require R2 availability.
The completed work-order outcome/cost paths remain covered by
`WorkOrderDocumentsIntegrationTests`; this feature does not introduce those
mutations. The new suite checks unchanged asset fields/events and unchanged
linked work-order state when removing the asset link.

Run the new suites from the repository root (Maven stays offline):

```bash
MAVEN_ARGS=-o pnpm nx run server:test --args='-Dtest=AssetDocument*Tests' --skip-nx-cache --output-style=static
pnpm nx run web:test --skip-nx-cache --output-style=static -- asset-association.test.tsx asset-documents-section.test.tsx
```

These tests were written and observed red before production implementation.
Existing permission denials already passed; successful associations and the new
Documents section failed through HTTP status assertions or accessible queries.

Observed red on 2026-10-27: 33 server cases (32 failed, one permission denial
already passed) and 29 web cases (27 failed, two existing permission safeguards
passed). Failures reach HTTP status assertions or accessible queries for the
missing asset-link controls/Documents section; there are no compilation or
missing-module failures. Workspace type checking and `pnpm fix` pass.

The initial full server run completed 1,415 cases with only the 32 new expected
failures. The full web run completed 798 cases: 27 new expected failures and
one existing inspection-follow-up test failure. Running that existing
`inspection-results.test.tsx` suite separately passed all 32 cases; no
inspection code or tests were changed.

## Implementation verification (2026-10-27)

- `MAVEN_ARGS=-o pnpm test --skip-nx-cache --output-style=static` passed:
  1,415 Java tests and 799 web tests. All 33 server and 30 browser association
  cases pass. An additional browser boundary was written, observed failing and
  fixed so document-only users do not request owner-scoped estate details.
- The ownership-revocation test originally expected 404 while retaining the
  former owner's MANAGER membership. After observing the mismatch, the assertion
  was corrected separately to 403, consistent with other accessible-but-denied
  Managers. Its assertion that the original association remains intact is retained.
- Prisma generated and applied `20261027122339_document_asset_association` in
  disposable Postgres replaying the local migrations. Prisma client generation
  ran through the Nx target; jOOQ generation used the same Maven `jooq` profile
  against that disposable database, keeping generated classes aligned with the
  checked-in schema. `pnpm api:generate` ran with temporary Spring datasource
  JVM properties pointing to the same database.
- Shared dev had existing history drift: applied
  `20261026020000_asset_event_costs` is absent locally. `migrate dev` stopped
  without resetting anything. `migrate status` confirmed the new association
  migration was the only pending local migration; the tested additive file was
  then successfully applied through Infisical and `pnpm db:deploy`. No shared
  data was reset, and the unrelated cost columns/history were left intact.
- Manual browser checks remain pending because no browser automation tool,
  installed Playwright/Puppeteer or browser executable is available in this
  environment. Repository rules prohibit installing one. jsdom interaction
  tests cover the functional flows; they do not establish mobile layout,
  visual themes or real-browser focus behavior.

## Implementation phases

- [x] **Confirm product scope.** Record asset-editing authority for link/unlink,
  retired-asset eligibility and no extraction/verification requirement.
- [x] **Server red.** Write and observe failing HTTP/integration tests for linking
  ordinary uploads, unlinking while retaining file/work-order relation, durable
  attachment reads, permission boundaries without an `EDIT_DOCUMENTS` gate,
  retired assets, inactive estates, same-estate checks, missing/deleted records,
  all picker filters, required nullable target, no-ops, stale/concurrent requests
  and transactional rollback. Cover both directions of work-order consistency
  and unchanged equipment/condition/cost data. Use disposable migrated Postgres
  with Testcontainers, not shared estate data.
- [x] **Data and server green.** Add the Prisma migration, regenerate database
  clients/jOOQ, implement thin controllers and transactional services, and make
  the observed failing tests pass. Add failing tests before further behaviour
  changes. Regenerate the API contract and check consuming types.
- [x] **Web red.** Write and observe failing tests in `apps/web/tests/`, mirroring
  affected route folders. Cover complete searchable/filterable asset selection,
  UUID choice, link/unlink confirmation and cancellation, role/lifecycle gates,
  retired-asset actions, ordinary upload eligibility, refresh persistence,
  conflict/uncertain-response recovery, attachments/download and account/estate
  isolation. Use `renderWithProviders` and accessible role/name queries.
- [x] **Web green.** Implement route-local shadcn components and feature hooks;
  preserve folder-based routes on touched screens. Make the tests pass.
- [x] **Automated verification and documentation.** Run relevant Nx targets,
  `pnpm fix`, `pnpm check-types` and `pnpm test`. Update `.docs/api/asset-documents.md`,
  `.docs/frontend/asset-documents.md`, affected documents/assets/work-order docs
  and `.docs/README.md`. Record the architectural choice in decision 0041.
  Leave all changes uncommitted for the human.
- [ ] **Manual browser acceptance.** Manually verify upload → search/filter →
  link → reload → asset attachment/download → unlink → reload, including a
  retired asset, a retained work-order link, denied roles/second-estate access
  and mobile/keyboard use. Mark fully accepted only after these checks.

## Out of scope

- OCR/extraction, verification, automatic matching, bulk linking, creating assets
  from documents and cross-estate links.
- Many-to-many links, direct replacement of an existing asset link, correction
  reasons and a full association-history UI. Moving a document uses unlink/link.
- Changing equipment master fields, maintenance events, costs or work-order
  outcomes; document timeline/orphan-queue features.
- New upload/storage pipelines, changes to document deletion/download permissions,
  new asset-editing roles, dependency installation or asset-register pagination.

## Open questions

None remaining from the original product-scope questions. Implementation should
reuse the current asset-editing authorization and existing document contracts.
