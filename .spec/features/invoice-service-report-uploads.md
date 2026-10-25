# Invoice and service-report uploads

**Status:** implemented and verified on 2026-10-25 — acceptance and full regression suites passing
**Owner:** to be assigned

## Confirmed decisions

The user confirmed the following on 2026-10-25:

- Each file is capped at **5 MB**, defined here as **5,000,000 bytes**.
- Each submission contains **exactly one file**.
- **Council, assigned Managers and Crew** can upload, list and download documents
  in their assigned estates. The existing estate-owner authority is retained.
- The original format checks are sufficient: extension, declared media type,
  file signature and bounded image decoding, preserving the uploaded bytes.
  Malware scanning and full PDF parsing remain outside this feature.
- Users can **search by filename** within their authorized estate document list.
- Only **the uploader or a Manager of that estate** can delete a file. The
  existing owner-as-Manager authority applies. Council and Crew can delete their
  own uploads; they cannot delete someone else's file merely because of their
  role. The uploader must still have current document access in that estate.
- Add exactly two assignable permissions covering both invoices and service
  reports: **`VIEW_DOCUMENTS`** for read access and **`EDIT_DOCUMENTS`** for write
  access. `EDIT_DOCUMENTS` requires `VIEW_DOCUMENTS`. Custom roles can receive
  these permissions; Council, assigned Managers, Crew and owners retain their
  previously agreed access. Write access does not override the uploader-or-Manager
  restriction on deletion.

## Problem

Managing agents cannot upload invoices and service reports as indexed documents
in the platform. Paper copies and files held outside the system are difficult to
find and do not have a platform-controlled storage or access boundary.

**User story:** As a managing agent, I want to upload PDF and photo formats of
invoices and service reports to the platform so that they are securely stored in
Cloudflare R2 rather than remaining as unindexed paper files.

## Existing foundations

- Spring already uses the AWS S3-compatible Java SDK for private R2 storage in
  `resident/ResidentImageStore.java`. Its configuration is `S3_ENDPOINT`,
  `R2_ACCESS_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET_NAME`.
- Resident report images have their own validation, metadata and cleanup under
  `reports/`. Their image validator re-encodes uploads; document originals need
  separate validation so invoice contents and PDF signatures are preserved.
- Spring currently limits individual multipart files to 5 MiB and complete
  requests to 17 MiB. Enforce the document-specific 5,000,000-byte limit in
  application validation; the servlet limit remains a coarser upper bound.
- Estate ownership, memberships and current permissions are enforced by
  `EstatePermissions`. The frontend receives estate capabilities from
  `GET /access/context`.
- No document table or invoice/service-report upload screen exists. Work-order
  document association is explicitly a separate story in the work-order specs.

## Behaviour

The file limit, one-file submissions, preset role access, two document permissions,
original validation approach, filename search and uploader-or-Manager deletion
rule are confirmed. The technical approach below describes how to implement them.

### Read and edit permissions

| Permission code | Catalogue label | Requires | Grants within the assigned estate |
| --- | --- | --- | --- |
| `VIEW_DOCUMENTS` | View invoices and service reports | None | List documents, search filenames and download files |
| `EDIT_DOCUMENTS` | Edit invoices and service reports | `VIEW_DOCUMENTS` | Upload files and delete own uploads; Managers retain deletion of any document in their estate |

Both codes apply to invoices and service reports together. They grant no access
to resident fault reports or their images. “Edit” describes the write operations
in this feature (upload and permitted deletion); renaming, replacing and editing
file contents remain outside scope.

Current owners/Managers, Council and Crew receive both capabilities through their
existing preset role rules. Custom roles receive only their explicitly assigned
codes. A custom role with `VIEW_DOCUMENTS` alone has read-only access, including
when its holder uploaded a document previously. Deletion requires edit access as
well as the uploader-or-Manager condition. `EDIT_DOCUMENTS` alone is invalid;
prerequisites must be explicitly selected, matching the existing role system.
Neither permission requires `VIEW_ESTATE` or general management access.

### Access and accepted files

1. A signed-in user with effective `VIEW_DOCUMENTS` access can list, search and
   download documents in that estate. Upload requires effective `EDIT_DOCUMENTS`
   access and an active estate. Preset owner/Manager/Council/Crew access is
   retained; custom roles use the explicit grants above. Authority comes from
   the authenticated subject and live estate data, following the existing
   same-estate Resident restriction. Other estates' roles confer no authority.
   `MEMBER` and `RESIDENT`
   memberships alone grant no document access; custom membership requires the
   corresponding document grants. Missing identity returns 401 even in local
   open-security mode; known unauthorized members
   receive 403 and inaccessible estates 404.
2. Each submission contains exactly one file and a required document type:
   `INVOICE` or `SERVICE_REPORT`. Multiple files and unexpected file parts return
   400. Uploads are independent of assets and work orders.
3. Supported extensions are `.pdf`, `.jpg`, `.jpeg` and `.png`, case-insensitively.
   Canonical media types are `application/pdf`, `image/jpeg` and `image/png`.
   The server checks the extension, declared media type and file signature for
   consistency; JPEG/PNG data must also decode successfully. Browser filtering
   is a convenience; server validation is authoritative. Unsupported types or
   type mismatches return 415.
4. Files must contain between 1 and 5,000,000 bytes inclusive (5 MB). Empty files
   return 400; larger files return 413. Apply bounded image decoding, initially
   using the existing resident-image pixel budget of 12,192,768 pixels, with
   either portrait or landscape orientation allowed. An unreadable image or an
   image exceeding this budget returns 400 with a specific message.
5. Preserve the uploaded file bytes. Do not re-encode photos, modify PDFs or
   overwrite an earlier document because filenames match. PDF checks in this
   scope identify the format; they do not parse, execute or render PDF content.
   Reject missing/blank filenames and filenames longer than 255 characters;
   remove path components and reject control characters before storing a display
   filename. Client filenames never determine storage paths.

### Storage and indexing

6. The browser submits multipart data to Spring through the generated API client.
   Spring validates and uploads the file to private R2 storage over HTTPS. R2
   credentials stay on the server. Public bucket URLs and client-side storage
   credentials are not part of the flow.
7. Assign a server-generated UUID and an object key such as
   `documents/{estateId}/{documentId}`. Save indexed metadata in Postgres only
   after R2 acknowledges the write. A response exposes the document ID and
   metadata, never the bucket credentials or private object key.
8. Recheck current authority and active-estate state inside the metadata write
   transaction after taking the estate lock. Do not hold a database transaction
   open during the R2 request. Permission revocation or estate deactivation
   during upload prevents the metadata commit and triggers object cleanup.
9. Return 201 only when both the R2 write and metadata commit have succeeded.
   An R2 outage or missing storage configuration returns 503. A database failure
   returns a generic 5xx error. Neither case produces a successful document row
   or a success confirmation. Attempt to delete any object staged by a failed
   submission; a bounded scheduled sweep handles leftovers from failed cleanup
   or interrupted requests.
10. The estate's document list contains committed uploads with filename, document
    type, file size and upload time, newest first with ID as a stable tie-breaker.
    Use cursor pagination: default 25, maximum 100 items. Current estate owners,
    assigned Managers, Council, Crew and custom roles with `VIEW_DOCUMENTS` can
    list and download files, including historical files in inactive estates;
    inactive estates reject new uploads with 409.
11. Downloads pass through Spring after a fresh estate authorization check and a
    document lookup scoped to both document ID and estate ID. Foreign/missing
    documents return 404. Return the stored media type, a safely encoded
    `Content-Disposition: attachment` filename, `X-Content-Type-Options: nosniff`
    and `Cache-Control: private, no-store`. Metadata reads also use private,
    non-cacheable responses. Document bytes and secrets do not appear in logs.

### Upload experience

12. The Documents screen identifies the estate, lets an authorized user select
    Invoice or Service report and choose a file, and displays accepted formats
    and limits before submission. Upload is disabled while a request is pending
    and a labelled status reads “Uploading…”. No percentage is shown without
    measured transfer progress.
13. After a 201 response, show an accessible success message and toast:
    “\"{filename}\" uploaded successfully.” Clear the submitted selection and
    refresh the document list. A later list-refresh failure must not relabel the
    completed upload as failed; show a separate list error with retry.
14. Invalid type, size, empty-file and image-validation errors identify the
    problem and permitted correction. For example: “Use a PDF, JPEG or PNG file”
    or “Choose a file no larger than 5 MB.” Server and transport errors show an
    accessible alert and keep the document type and file selection where the
    browser permits. Never automatically retry an upload.
15. If the connection fails after submission, explain that completion could not
    be confirmed and ask the user to refresh the document list before retrying.
    An explicit second submission creates a separate document; deduplication and
    idempotency keys are outside this first version.

### Filename search

16. The document list has a labelled “Search by filename” input and Search/Clear
    actions. Search matches a case-insensitive, literal substring of the stored
    display filename, including its extension. For example, `invoice` matches
    `April Invoice.PDF`. Trim the search input; blank means no filename filter.
    Reject search text longer than 255 characters with 400. Treat `%`, `_` and
    backslashes as literal filename characters, using parameterized, escaped
    database matching.
17. Apply estate authorization, exclusion of deleted documents and the filename
    filter in the database before pagination. Keep the existing newest-first
    ordering. Applying or clearing search resets pagination and retains the
    search in the route URL for refresh/back. A cursor from a different estate
    or normalized search is invalid (400). Distinguish “No documents uploaded”
    from “No files match your search”; the latter offers Clear search.

### Deletion

18. An authenticated user with current effective `EDIT_DOCUMENTS` access can
    delete a document only if they uploaded it or currently have Manager authority
    in its estate. Edit permission alone never grants deletion of another user's
    file.
    Check the stored uploader subject; never accept uploader/role claims from
    the request body. Another estate's Manager has no authority. The uploader
    does not retain deletion rights after losing estate document edit access.
    Deletion is allowed in inactive estates for otherwise authorized callers.
19. The server returns a per-document `canDelete` capability using the same rule.
    The screen shows Delete only when it is true. A confirmation dialog names
    the file and explains that it will be removed; Cancel makes no request.
    Confirm disables repeat submission while pending. Server authorization is
    rechecked even if an earlier response showed the control.
20. Under the estate lock followed by the document lock, recheck authority and
    commit a deletion marker and authenticated actor. The file immediately stops
    appearing in lists/search and new download requests return 404. A download
    already authorized/in progress may finish. Retain the minimal internal row
    for authorization, deletion audit and reliable R2 cleanup; it is not a
    user-visible archive or a restore feature.
21. After the database commit, attempt to delete the private R2 object outside
    the transaction and mark successful storage deletion. A bounded scheduled
    worker retries marked documents whose object deletion is unconfirmed; a
    process crash or provider failure must not lose the cleanup task. An already
    absent object counts as removed. Never remove the R2 object before committing
    the deletion marker, which would leave a visible document without its bytes
    if the database write failed.
22. Return 204 once platform deletion is committed. Object removal is attempted
    promptly and may finish through background retry; 204 confirms the resource
    is no longer available through the platform, not immediate physical erasure
    from R2. If the database commit fails, return a generic 500, keep the object
    and visible document intact, and do not show success. Retrying deletion of an
    already marked document returns 204 only after the same live permission
    checks; never recreate it or replace its original deletion audit values.
23. On 204, close the dialog, announce “\"{filename}\" removed” and invalidate the
    estate's document lists across all filename searches. A subsequent refresh
    failure is a separate list error. A denied or failed request retains the
    dialog with an actionable error and offers retry. Do not automatically retry
    mutation requests or report unconfirmed physical erasure as completed.

## Data

Add `Document` and the inverse `Estate.documents` relation in
`packages/db/prisma/schema/schema.prisma`. `IssueReportImage` remains separate.

| Field | Proposed storage and rule |
| --- | --- |
| `id` | UUID primary key, server-generated |
| `estateId` | UUID foreign key to `Estate`, restrict deletion/update |
| `documentType` | String constrained to `INVOICE` / `SERVICE_REPORT` |
| `originalFilename` | Sanitized display filename, varchar(255), nonblank |
| `contentType` | Validated canonical media type, varchar(50) |
| `sizeBytes` | Positive integer, at most 5,000,000 |
| `storageKey` | Private unique varchar(500) |
| `uploadedByUserId` | Authenticated subject, varchar(255); audit value, never supplied by the browser |
| `createdAt` | Server timestamp, timestamptz(6) |
| `deletedAt` | Nullable server timestamp, timestamptz(6); committed platform deletion marker |
| `deletedByUserId` | Nullable authenticated deletion actor, varchar(255) |
| `storageDeletedAt` | Nullable server timestamp, timestamptz(6); confirms the marked document's R2 object has been removed |

Index `(estateId, createdAt, id)` for the list. Apply constraints through the
Prisma migration and regenerate jOOQ; do not edit generated Java sources.
There is no upload-status column: a document row represents a completed upload.
List/search/download queries exclude rows with `deletedAt` set. The cleanup worker
selects marked rows with no `storageDeletedAt`, using a deletion-marker index to
bound each run. `storageDeletedAt` cannot be set on an unmarked document. Retain
the unique storage key so deletion retry never targets a later upload.

Filename search operates on `originalFilename` after estate scoping; no full-text
search service, extension or additional package is needed. Do not claim the
existing `(estateId, createdAt, id)` index accelerates arbitrary substring matches.
No automated expiry of undeleted documents is introduced in this feature.

Extend the existing `Permission` catalogue with exactly two rows, seeded by a new
Prisma migration: `VIEW_DOCUMENTS` and `EDIT_DOCUMENTS`, with the labels above and
descriptions of their read/write scope. Add both to `EstatePermissionCode` and
declare `EDIT_DOCUMENTS.requires() = [VIEW_DOCUMENTS]`. The existing
`EstateRolePermission` model stores custom-role grants; no extra permission or
role-assignment table is needed. Preset roles keep their existing representation.
Do not edit an already applied catalogue migration.

## API

List/search/download require effective `VIEW_DOCUMENTS`; upload/deletion require
effective `EDIT_DOCUMENTS`, including the preset role rules above. Deletion also
requires the uploader-or-Manager condition. Use real Java DTOs and document binary
multipart fields and error responses in OpenAPI.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/documents` | `multipart/form-data`: `documentType`, one binary `file` | 201 `DocumentResponse`; `Location` points to its content endpoint | Effective `EDIT_DOCUMENTS`; active estate |
| GET | `/estates/{estateId}/documents` | Optional `filename` substring (max 255 characters after trimming), opaque `cursor` and integer `limit` | 200 `DocumentPageResponse` | Effective `VIEW_DOCUMENTS`; inactive history allowed |
| GET | `/estates/{estateId}/documents/{documentId}/content` | UUID path parameters | 200 binary attachment | Effective `VIEW_DOCUMENTS`; inactive history allowed |
| DELETE | `/estates/{estateId}/documents/{documentId}` | UUID path parameters; no body | 204, no body; durable platform removal with retried R2 cleanup | Effective `EDIT_DOCUMENTS` AND (uploader OR estate Manager/owner); inactive estates allowed |
| GET | `/access/context` | Existing request | Existing response with estate-level `canViewDocuments` and `canUploadDocuments` booleans | Existing authenticated access projection |
| GET | `/estates/{estateId}/role-permissions` | Existing request | Existing catalogue response includes the two new codes and edit prerequisite | Existing role-authoring authorization and bounded catalogue filtering |

`DocumentResponse`: `id: UUID`, `estateId: UUID`,
`documentType: INVOICE | SERVICE_REPORT`, `originalFilename: string`,
`contentType: string`, `sizeBytes: integer`, `createdAt: ISO-8601 timestamp`,
`canDelete: boolean`.
`DocumentPageResponse`: `items: DocumentResponse[]`, `nextCursor: string | null`.
The uploader subject is stored for audit, not exposed by this response.

`canViewDocuments` reflects effective `VIEW_DOCUMENTS`. `canUploadDocuments`
reflects effective `EDIT_DOCUMENTS` and an active estate. `canDelete` is computed
per document from effective edit access and the uploader-or-Manager condition;
it does not require an active estate. The projection and server guards must use
the same estate-local permission resolution, including preset role defaults.

Errors use the existing `EstateError` shape (`message: string`): 400 invalid
multipart fields/metadata, empty or unreadable image, invalid filename search or
cursor/limit; 401 missing/invalid identity; 403 denied role or deletion of another
user's upload without Manager authority; 404 inaccessible estate or missing/
foreign document, including deleted content downloads; 409 inactive estate on
upload; 413 oversized file/request; 415 unsupported or mismatched format;
503 unavailable storage on upload/download; generic 500 for an unexpected
persistence failure. A referenced object missing from R2 is a storage
inconsistency reported as 503 and logged with the document ID. R2 cleanup failure
after a committed deletion follows the durable retry path above.

## Frontend

- Add `apps/web/src/routes/_auth/estates/$estateId/documents/index.tsx`, with
  screen-only components beside it in `-components/`. Add an estate navigation
  entry guarded by `canViewDocuments`; upload controls use `canUploadDocuments`.
  Route guards run before mounting protected queries. Inactive history remains
  available with upload disabled and a visible explanation.
- Council and Crew must be able to reach Documents through navigation and direct
  links without management-only permissions or management-detail queries. Include
  document access in workspace-entry and estate-switching decisions where needed;
  unrelated management screens remain governed by their own capabilities.
- Custom roles with document permissions must also reach Documents without
  `VIEW_ESTATE` or management-detail queries. Read-only users see search, list
  and download, with upload and Delete controls hidden. The existing role editor
  displays the two new catalogue entries and the edit-to-view prerequisite;
  reuse its dynamic catalogue UI and exact prerequisite validation. Reuse the
  existing role-change cache invalidation so revocation refreshes access and lists.
- Use existing shadcn `Input` (file), `Label`, `Select`, `Button`, `Alert`,
  `Spinner` and `Table`, plus the existing Sonner toaster. Label fields and
  associate validation messages; success uses `role="status"`, errors
  `role="alert"`. Include loading, empty, list-error and retry states.
- Use the existing shadcn `Dialog` and `Button` for filename-specific delete
  confirmation and a shadcn `Input` for filename search. Per-row Delete visibility
  comes from `DocumentResponse.canDelete`, not inferred frontend role strings.
- Add hooks in `apps/web/src/lib/documents.ts`. Use the generated client and
  generated DTO types, React Query, and the existing AuthTokenBridge. Use the
  existing multipart FormData approach; never manually set its boundary.
- List key: `[userId, "documents", estateId, { filename, cursor, limit }]`, using
  the trimmed filename search. Invalidate `[userId, "documents", estateId]` after
  a confirmed upload or deletion, covering all cached searches. Session-gate reads
  and discard old account/estate results on context changes. Disable automatic
  mutation retries. Downloads use the typed client with blob parsing and revoke
  temporary browser object URLs after use; avoid caching file blobs.

## Edge cases

- An oversized upload can be rejected by the servlet multipart layer before the
  controller runs. Ensure document endpoints return the same actionable 413
  response in this path; preserve resident-report limits and their error handling.
- Two simultaneous files with identical names get independent UUIDs and rows.
  A double click while pending sends one request; separate attempts remain
  separate uploads.
- A client-disconnected request may still finish on the server. Report uncertain
  outcomes truthfully and provide the list for reconciliation.
- Orphan cleanup examines only `documents/`, checks `Document.storageKey`, skips
  referenced objects, and leaves recent objects alone. Initially reuse the
  existing 24-hour grace period and bounded hourly sweep pattern. It must never
  inspect document keys against resident-report metadata or delete report images.
- If the database cannot establish whether an object is referenced, skip deletion
  and retry later. Storage outages never trigger metadata deletion.
- Marked document rows still reference storage keys. Their explicit deletion
  worker must remove their objects independently of the unreferenced-object sweep;
  otherwise the orphan check would preserve deleted files forever. Use a bounded
  batch on each hourly cleanup run, isolate individual failures and record
  `storageDeletedAt` only after R2 confirms removal. Leave unmarked document
  objects untouched and retry if recording a successful removal fails.
- A Manager and uploader deleting the same file concurrently serialize on the
  same locks. Both authorized attempts may receive 204, with one deletion marker
  and one original audit actor. Pending R2 cleanup is safe to repeat.
- Revocation or demotion between list and delete takes effect at the deletion
  transaction's permission check. In-progress deletion cleanup acts only on a
  previously authorized, committed marker; it grants no interactive access.
- Removing `EDIT_DOCUMENTS` while retaining read access immediately prevents
  upload and own-file deletion on subsequent requests. Unknown custom-role
  permission codes, missing catalogue rows and incomplete prerequisites follow
  the existing fail-closed rules; an edit grant alone never becomes valid read access.
- Seed the new catalogue rows before an API revision enumerates the new codes.
  All serving revisions must recognize the codes before roles can save grants
  containing them; older revisions reject unsupported grants. Include this in
  the existing compatible-reader-before-grants release workflow.
- Search results and all pagination cursors remain estate-scoped. Similar names
  in another estate or on deleted documents never appear in results.
- PDF files with active content are delivered only as attachments. Format
  identification is not malware scanning or full PDF structural validation.

## Implementation phases

All phases remain unchecked until this draft is agreed. For each behaviour,
write and run its failing test before implementing it, following
`../testing.md`.

- [ ] **Review the technical plan.** Product rules above are confirmed. Review
  the search matching and durable deletion approach before implementation.
  Record the storage/access/deletion decision in `.spec/decisions/` during
  implementation and link it from the decision index.
- [ ] **Data and authorization.** Start with failing server integration tests for
  estate isolation, upload/list/download for each allowed role (owner, assigned
  Manager, Council and Crew), denied Resident/Member/ungranted-custom-role access,
  missing identity, inactive-estate uploads and audit metadata. Add deletion tests for
  own-file Council/Crew, another uploader's denial, Manager deletion of another
  uploader's file, cross-estate denial, membership revocation and inactive-estate
  deletion. Add the Prisma model and migration, regenerate Prisma and jOOQ with
  `pnpm db:migrate` /
  `pnpm db:generate`, and implement typed repositories and access capabilities.
- [ ] **Read/edit permission integration.** First run failing tests for both
  catalogue entries, `EDIT_DOCUMENTS` requiring `VIEW_DOCUMENTS`, a read-only
  custom role, a read/edit custom role, denial of another uploader's deletion,
  and revocation during upload/deletion. Add the enum codes, prerequisite and
  migration-seeded catalogue rows. Reuse live estate permission resolution,
  preserving Council/Crew defaults; update collection predicates and individual
  guards together. Verify Managers can grant both codes, delegated role authors
  can grant only permissions they hold, and existing custom roles gain no grants
  automatically. Cover role-editor catalogue/prerequisite behaviour and
  regenerate the API enum/types with the endpoint contract.
- [ ] **Validation and R2.** Start with failing tests for all three supported
  formats, exact size boundaries (5,000,000 bytes accepted; 5,000,001 rejected),
  empty files, MIME/extension/signature mismatch, bounded image decoding and
  unchanged stored bytes, plus rejection of multiple files before any R2 write.
  Use the existing SDK and configuration; extract only the shared R2 client setup
  needed by both consumers.
  Keep report validation and prefix-specific cleanup separate. Cover R2 failures,
  metadata failures, revocation during upload and orphan recovery with a fake
  storage boundary. Cover deletion-marker commit failure, failed R2 removal,
  crash recovery, safe retry and separation from orphan cleanup; regression-test
  existing resident image upload/read/cleanup.
- [ ] **API and contract.** Implement thin controllers and explicit status/error
  documentation. Test upload, filename search, paginated listing, authorized
  download and deletion via HTTP. Cover case-insensitive partial filename matches,
  whitespace/empty searches, literal wildcard characters, excessive search length,
  estate isolation, filtering before pagination and mismatched search cursors.
  Verify per-document `canDelete`, deleted-file exclusion, concurrent deletes,
  servlet-level 413 responses and download headers. Run
  `pnpm api:generate` and keep both generated contract files with the Java change.
- [ ] **Web.** Begin with failing Vitest/Testing Library tests for selection,
  type/size feedback, pending state, confirmed success, server errors, uncertain
  completion, list refresh failure and account/estate isolation. Use
  `renderWithProviders`, accessible queries and tests mirroring route folders.
  Cover Council/Crew navigation and direct links without management authority.
  Cover document-only custom-role navigation, read-only upload/Delete controls,
  read/edit upload and own-file deletion, and access refresh after role changes.
  Add tests for one-file selection, filename search/Clear with URL/pagination
  behaviour, no-match feedback, per-row deletion visibility, confirmation/Cancel,
  success/failure handling and invalidation across search variants. Implement the
  screen, hooks, search, download, deletion and capability-gated navigation.
- [ ] **Operational verification and documentation.** Verify a private bucket
  and bucket-scoped credentials via the existing Infisical server folders for
  each environment. A human supplies any missing secret values. Run a controlled
  R2 smoke check for PDF/JPEG/PNG upload and authenticated download with byte
  comparison, and verify anonymous object access is denied. Check filename search
  and deletion as uploader versus another Council/Crew member versus a Manager;
  verify the object is removed from R2 and failed removals are retried. Update
  `.docs/api/documents.md`, `.docs/frontend/documents.md`, `.docs/README.md` and
  the affected access/shell and API/frontend estate-role documentation to match
  the implementation. Run
  `pnpm fix`, `pnpm check-types`, `pnpm test` and the Nx web build, since the
  architecture notes that web type errors surface at build time. Leave changes
  uncommitted for human review.

No dependency installation, bucket changes, deployment, schema migration or
implementation is authorized by this planning document alone. If implementation
needs another package, declare it for the human to install rather than fetching
it automatically.

## Test coverage and current verification

The user requested executable tests on 2026-10-25. Tests exercise the planned
HTTP contract and real registered web route without introducing production
controllers, database migrations, frontend components or generated API types.

| Suite | Coverage |
| --- | --- |
| [DocumentPermissionTests.java](../../apps/server/src/test/java/com/proj/server/estate/DocumentPermissionTests.java) | Read/edit grant recognition, explicit prerequisite, rejection of incomplete or unknown sets |
| [DocumentUploadsIntegrationTests.java](../../apps/server/src/test/java/com/proj/server/DocumentUploadsIntegrationTests.java) | PDF/JPEG/PNG byte preservation, 5 MB boundary, exactly one file, invalid metadata/types/images, preset access, cross-estate isolation, upload/storage/database failures, revocation, filename search/pagination, deletion/audit/concurrency and cleanup retry |
| [DocumentRolePermissionsIntegrationTests.java](../../apps/server/src/test/java/com/proj/server/DocumentRolePermissionsIntegrationTests.java) | Seeded catalogue, read-only and read/edit custom roles, bounded delegation, live revocation, owner/Manager/Council/Crew access capabilities |
| [DocumentMultipartLimitsIntegrationTests.java](../../apps/server/src/test/java/com/proj/server/DocumentMultipartLimitsIntegrationTests.java) | Real HTTP requests covering application file limits and servlet file/request limits; MockMvc alone bypasses multipart parsing |
| [DocumentLocalSecurityIntegrationTests.java](../../apps/server/src/test/java/com/proj/server/DocumentLocalSecurityIntegrationTests.java) | Missing identity is denied even in local open-security mode |
| [Documents route tests](../../apps/web/tests/routes/_auth/estates/$estateId/documents/index.test.tsx) | Single-file chooser, upload feedback/errors/uncertain completion, read-only controls, search/URL/pagination/empty states, download, deletion confirmation/errors/cache invalidation and account/estate isolation |
| [Document navigation tests](../../apps/web/tests/components/document-navigation.test.tsx) | Capability-gated Documents links and document-only entry without management queries |

`DocumentTestSupport` uses committed fixtures in disposable migrated Postgres,
with cleanup limited to the estates created by each test. `DocumentR2Stub`
provides a local S3-compatible storage boundary, including provider failures and
permission/deactivation callbacks after object writes. No real R2 bucket or live
database is contacted. Cleanup tests run registered scheduled work synchronously;
they do not wait for the hourly timer. The existing shared catalogue expectation
now includes exactly eleven codes, reflecting the two requested additions.

Verification before implementation:

- The focused permission suite runs four tests: three expected assertion failures
  for missing document permissions and one passing fail-closed regression check.
- The two new web suites run 35 cases: 33 expected failures for missing document
  screen/navigation and two passing denial checks. No unresolved future-component
  imports or placeholder production implementations are used.
- All Java test sources compile. On the latest requested retry on 2026-10-25,
  Docker became reachable (`docker info` reports server version 29.9.2), and
  Testcontainers started disposable migrated Postgres successfully. All four
  document integration suites ran: **77 cases, 5 passed, 68 assertion failures,
  4 errors, 0 skipped**. The previous Docker startup blocker is resolved.
  Most failures are expected HTTP 201/400/415 responses receiving 403 because
  document routes are not implemented/allowed yet; other failures cover missing
  catalogue codes, missing access capabilities and local-mode identity handling.
  The four errors are null field reads in the parameterized inactive-estate
  capability check because `canViewDocuments` / `canUploadDocuments` do not yet
  exist in the response. They are distinct from the earlier Docker setup errors.
- `pnpm check-types` passes. `pnpm fix` has been run; this remains the red stage
  of TDD, so the feature suites are intentionally not green.

Focused commands, from the repository root:

```bash
./mvnw -o -pl com.proj:server -Dtest=DocumentPermissionTests test
./mvnw -o -pl com.proj:server -Dtest='Document*IntegrationTests' test
pnpm nx run web:test --output-style=static -- documents/index.test.tsx document-navigation.test.tsx
```

The direct Maven commands are intentional: the installed Nx Maven batch runner
ignored the attempted test-class filters and ran unrelated suites. Offline Maven
keeps the checks from fetching dependencies. The web filters avoid the literal
`$estateId` path segment, which Nx's command wrapper expanded as a shell variable.

The real private-bucket/credential/TLS smoke check remains an operational check
for implementation; a local storage double cannot establish Cloudflare account
configuration. Actual process termination, an hour-long scheduler interval and
HTTP disconnect timing are not reproduced: persisted deletion markers, repeatable
cleanup and uncertain-upload UI paths cover the corresponding recovery contracts
without fixed sleeps. No full PDF parsing or malware-scanning tests are added
because those behaviours remain outside the agreed scope.

## Implementation

The implementation now includes the Prisma Document migration and two seeded
permissions, generated Prisma/jOOQ/API types, Spring document endpoints,
byte-preserving bounded validation, private R2 storage, cursor filename search,
audited deletion/retry and orphan cleanup. The folder-based Documents screen
uses shadcn components and capability-based entry/navigation without management
queries. API/frontend documentation is indexed in `.docs/README.md`; decision
0036 records the storage and durable-deletion boundaries.

The acceptance suites pass: 77 document integration cases, four permission unit
cases and 36 web cases, including confirmed upload feedback during a pending
list refresh. The R2 fixture needed protocol corrections: a valid MD5
ETag and decoding of S3 streaming frames. No behavioral assertions were weakened.
Real HTTP limits also exposed Tomcat's default 2 MiB rejected-body drain causing
connection resets; a bounded 20 MiB drain delivers the JSON 413 response without
raising accepted multipart limits. Workspace type checks, web build and
`pnpm fix` pass. The final uncached combined `pnpm test` run passes all 1,192
server tests and 647 web tests with zero failures or skips. The live
private-bucket/TLS smoke check remains an operational
release check; automated storage verification uses the local S3-compatible stub.

## Out of scope

- OCR, full-text search, invoice-field extraction and document classification.
- Asset/work-order association, accounting workflows and contractor uploads.
- Bulk upload, drag-and-drop, resumable/direct-to-R2 upload and deduplication.
- Document editing, replacement, restoration, automated retention policies and
  version history. User-requested deletion is included.
- Additional formats such as HEIC, TIFF, DOCX or SVG; inline PDF previews.
- Malware scanning, content sanitization and full PDF parsing. If these are
  required, revise this spec before implementing a scanning/parsing workflow.
- Additional document permission codes beyond `VIEW_DOCUMENTS` and
  `EDIT_DOCUMENTS`, sharing links and permission to delete another uploader's
  files without Manager authority. The two planned permissions grant no broader
  management or fault-report access.

## Planning assumptions

The product questions are resolved. The plan uses case-insensitive substring
filename search, current estate access as a prerequisite for uploader deletion,
the two document permissions and the existing owner-as-Manager rule. Uploader
deletion additionally requires current edit access. Deletion removes platform
access first and completes physical R2 cleanup through a durable retry path.
No restore or automated expiry is included. The original bounded-image pixel
budget is retained.

## Storage references

The private-bucket approach follows the existing repository integration and
[Cloudflare's public bucket documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/).
Verify that neither public development URL access nor a public custom-domain
access path is enabled for the document bucket.
