# Resident fault reporting and restricted access

**Status:** implementation verified locally; dev migrations applied; database sources regenerated

Authorization and assignment decisions are superseded by the approved
[EstateUser authorization plan](resident-estate-user-authorization.md) and
[decision 0027](../decisions/0027-estate-user-resident-authority.md).
The original WorkOS resident-role and ResidentAssignment sections below are
historical planning context; the reporting content, image limits and ownership
requirements continue to apply.

**Planned policy revision (2026-10-18):** the
[estate role draft](estate-role-invitations.md) adds multi-estate resident
assignments and selected-estate submission, with manager invitation/role
management. Current Manager/Crew staff editing is limited to report location
under [fault report locations](fault-report-locations.md), preserving all other
report information and images apart from the correction's `updatedAt`. Broader
report editing/deletion is outside that work. These planned staff APIs do not
broaden the resident's submitter-only history endpoints.
The changes have not been implemented.
**Owner:** unassigned

## Problem

Residents need to report faults in their estate and follow their own reports
without gaining access to confidential estate, asset, council or other residents'
records. The current application has WorkOS authentication, application admin
roles and estate memberships, but no report models or resident estate assignment.
Estate membership alone is too broad for this story.

## Behaviour

- After successful sign-in, a resident lands on `/reports/new`, including when
  an earlier return URL points to a management page. Authentication redirects
  retain the existing same-origin validation and AuthKit session handling.
- Resident navigation exposes Report a fault, My reports and Sign out. The
  reporting screen shows only the assigned estate's identifying label.
- Resident attempts to visit management pages redirect to reporting before
  management components render or their queries run. This includes the signed-in
  home dashboard, estates, assets, devices, council and admin screens.
- Spring independently restricts residents to the explicit reporting endpoint
  allowlist below. Existing and future business endpoints outside that allowlist
  reject residents with 403, regardless of estate membership or ownership.
  Existing public authentication/health infrastructure remains available.
- A building is an estate in this feature. Estate assignment comes from trusted
  server data, never a self-selected estate ID or a client-supplied role. Each
  resident is linked to one estate at a time. Managers/admins will manage
  assignments in a later feature; assignment management is outside this scope.
  A resident without an active assignment sees an explanatory reporting screen
  and cannot submit.
- A report must include a title of 1–50 characters after trimming and free text;
  images are optional. Titles appear in history and detail; existing titles are
  backfilled as specified in [resident-report-title.md](resident-report-title.md).
  The description is capped
  at 2,500 characters and a resident may upload at most three JPEG/JPG/PNG images.
  Each image is capped at 5 MB and at a maximum width of 4,032 pixels and maximum
  height of 3,024 pixels. HEIC support is deferred. The combined multipart request is capped at
  17 MB, allowing overhead for three maximum-size images, text and multipart
  framing. The server receives the complete request, validates it, uploads the
  images to R2, and then persists the report metadata. Abandoned R2 uploads are
  deleted when validation, persistence or the request otherwise fails.
- Every report has a location selected from the assigned estate's existing
  active hierarchy. The form requires a block and then either a level or a
  common area. A common area may be directly under the block or under its
  selected level. The report location is the selected level or common area;
  a block alone is insufficient.
- The server derives submitter identity from the authenticated JWT subject and
  derives the estate from the current assignment. It validates that the chosen
  location belongs to that estate and is active, then creates the report with
  `SUBMITTED` status and a server-generated submission timestamp.
- Image validation checks decoded content as well as declared type, rejects
  malformed/unsupported files, and sets a decoded-pixel limit before processing.
  Images are private and are served only after report ownership authorization;
  filenames and storage keys never become public access credentials.
- Successful submission displays confirmation and opens the new report's
  detail page. While submitting, repeat clicks are disabled. Validation or
  upload failures retain form input and show actionable errors.
- My reports lists only the authenticated resident's past submissions, newest
  first, with pagination. Detail shows their submitted text, chosen location,
  images and current status. Submission history means past reports, not a resident-visible
  status-transition timeline. It never returns internal notes, staff identity or
  other confidential management fields.
- A newly accepted report has status `SUBMITTED`. Status management by a higher
  authority is outside this scope; residents can read the initial status.
- List, detail and image access enforce ownership in the server query;
  another resident's identifiers return the same 404 as nonexistent identifiers.
  Residents cannot modify status, submitter, estate or history.
- Missing/invalid authentication returns 401. Failure to resolve resident role
  or assignment does not grant management access or render management content.
- New reports require a current active assignment. Residents retain read access
  to their own historical reports after moving or assignment removal.

## Data

All additions originate in `packages/db/prisma/schema/schema.prisma`; Spring
uses regenerated jOOQ classes. Proposed models:

| Model | Fields and constraints |
| --- | --- |
| `ResidentAssignment` | `userId` (WorkOS subject, primary key for one current estate), `estateId`, `createdAt`, `revokedAt?`. The estate relation keeps the assignment scoped. Validate that the estate is active on assignment and submission. |
| `IssueReport` | UUID `id`, `submittedByUserId`, `estateId`, required `locationId`, required `title` (150 characters maximum), required `description`, `status`, `createdAt` (server-generated submission timestamp), `updatedAt`. The location relation is constrained to the same estate. Index submitter plus creation time and ID for stable pagination. |
| `IssueReportImage` | UUID `id`, `reportId`, private `storageKey`, validated `contentType`, `sizeBytes` (maximum 5 MB), `createdAt`. Images remain indefinitely with their reports. Restrict deletion with the parent. Objects are stored in the private Cloudflare R2 bucket configured by `R2_BUCKET_NAME`. |

Do not automatically translate `EstateUser.MEMBER` or `COUNCIL` into resident
access. WorkOS provides a trusted `resident` role. An account has exactly one
role at a time, so it cannot simultaneously be a resident and manager/admin;
role changes replace the previous role. Enforce this rule in the existing
WorkOS role-update flow as part of this feature. Resident access remains
restricted to reporting even if legacy estate grants exist. No new user profile
or credential store is needed.

## API

Proposed Spring endpoints; DTOs are Java records and become frontend types only
through OpenAPI generation. All require authenticated resident access.

| Method | Path | Request | Success response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/resident/context` | None | 200 `ResidentContextResponse { estate: { id: UUID, name: string } \| null, canSubmit: boolean }` | Current resident; minimal assigned-estate projection only |
| GET | `/resident/locations` | None | 200 `ResidentLocationResponse[]` | Current resident; active locations in assigned estate only; empty without active assignment |
| POST | `/resident/reports` | Multipart `title: string`, `description: string`, `locationId: UUID` (level or common area), `images?: binary[]` | 201 `IssueReportDetailResponse` and Location header | Resident with active assignment and active location in that estate |
| GET | `/resident/reports` | `cursor?: string`, `limit?: integer` (default 20, maximum 50) | 200 `{ items: IssueReportSummaryResponse[], nextCursor: string \| null }` | Filter by JWT subject |
| GET | `/resident/reports/{reportId}` | UUID path parameter | 200 `IssueReportDetailResponse` | Submitter only |
| GET | `/resident/reports/{reportId}/images/{imageId}` | UUID path parameters | 200 private image bytes with validated content type | Submitter only; image must belong to report |

`ResidentLocationResponse`: `id: UUID`, `type: BLOCK | LEVEL | COMMON_AREA`,
`name: string`, `parentId: UUID | null`, `sortOrder: integer | null`.

`IssueReportSummaryResponse`: `id: UUID`, `title: string`, `description: string`,
`estateName: string`, `location: { id: UUID, label: string }`,
`status: string`, `createdAt: timestamp`,
`updatedAt: timestamp`.

`IssueReportDetailResponse`: summary fields plus
`images: { id: UUID, contentType: string }`. The resident submission scope
uses status `SUBMITTED` only.

The resident creation endpoint writes `SUBMITTED`. Other status values and
status-management endpoints are outside this scope.

Errors use the existing API error shape: 400 validation/invalid cursor, 401
unauthenticated, 403 denied role or inactive/missing assignment on submission,
404 inaccessible/missing report or image, 413 oversized request, 415 unsupported
image media, and a generic 503 for unavailable image storage. Responses must not
expose storage paths, SQL details or another report's existence.

Authenticated image retrieval uses the generated client through feature hooks;
do not rely on an `<img src>` request to attach a bearer token. Render a local
blob URL from authorized bytes and revoke it when no longer needed. Image
responses use private, no-store caching.

## Frontend

- Folder routes: `apps/web/src/routes/_auth/reports/new/index.tsx`,
  `reports/index.tsx`, and `reports/$reportId/index.tsx`, all under `_auth`.
  Route-only components live beside their route in `-components/`.
- Apply role-aware entry and route guards to the callback/landing flow, protected
  routes and public home when signed in. Retain existing non-resident behavior.
- Use existing shadcn Textarea, Input for files, Label, Button, Card, Alert,
  Badge, Select and appropriate list/empty/loading presentation from `packages/ui`.
  Present the assigned estate's active location hierarchy as block, level and
  common-area choices; require a block plus a level or common area before
  submission. Keep the form
  keyboard-accessible, with labelled validation and image removal
  before submission. There is one image input (`accept="image/*"`, `multiple`,
  no forced `capture`) for selecting existing photos; supported mobile browsers
  also offer camera capture in their native chooser. The device/browser controls
  which choices appear. Refactor only touched screens as required by
  repository rules.
- Put generated-client React Query hooks in `apps/web/src/lib/reports.ts`.
  Keys begin with user ID: `[userId, "resident-context"]`,
  `[userId, "resident-locations"]`,
  `[userId, "reports", "list", cursor]`, `[userId, "reports", reportId]`,
  and `[userId, "reports", reportId, "image", imageId]`.
- Gate queries on resolved authenticated resident identity; invalidate that
  user's report lists after submission. Clear resident data/blob URLs at sign-out
  or identity change. Detail refresh/focus refetch shows updated statuses.

## Edge cases

- Tampered report/image/estate IDs, pagination cursors or identity fields must
  never bypass ownership or assignment checks. Test two residents in the same
  estate as well as residents in different estates.
- Reject a missing, block-only, inactive or cross-estate location on submission.
  A resident can select only an active level or common area in the assigned
  estate; historical reports
  retain their location even after it is deactivated or assignment is removed.
- Recheck assignment when committing submission so revocation or deactivation
  during upload cannot authorize a new report with stale data.
- Stage validated images privately; expose a report only once all selected
  images are durably stored and database creation succeeds. Clean up staged
  files on failure and provide bounded orphan cleanup for interrupted requests.
- A lost success response must not cause automatic POST retries. Preserve input
  and prompt the resident to check My reports before a manual retry; durable
  submission idempotency can be added only if required by the agreed scope.
- Empty history lists, expired sessions during upload, storage outages and
  role/context lookup failures have explicit loading/error/empty presentation.
- Render report text as text, never HTML. Decode/re-encode accepted images to
  remove metadata, enforce a bounded pixel count and use server-generated keys.
- Cross-user browser sessions and stale query caches must not reveal a previous
  user's report text or images. Authorization is checked on every server request.
- The current no-issuer development mode permits all requests at the filter
  layer. Reporting services must still require a real principal; do not invent
  a fallback resident. Test authorization with JWT security enabled.

## Implementation phases

- [ ] Agree this draft before implementation.
- [ ] Write and observe failing server tests for resident denial of management
  APIs, allowed reporting access, ownership isolation and assignment boundaries.
  Implement the narrow permission policy while preserving non-resident access.
- [ ] Add Prisma models/migration, run `pnpm db:migrate` and `pnpm db:generate`,
  and compile through Nx. Record agreed role/estate/storage decisions in an ADR.
- [ ] In red-green increments, implement report creation, validation, private
  image storage/retrieval, own-report pagination and detail/history endpoints,
  including required location selection and validation.
  Use JUnit and migrated Postgres Testcontainers for database/security behavior.
- [ ] Run `pnpm api:generate`; include OpenAPI and generated TypeScript with
  the controller changes. Do not hand-write frontend API types.
- [ ] Write and observe failing Vitest/Testing Library tests for login landing,
  deep-link restrictions, resident navigation, required location selection,
  text-required/image submission,
  failures, own history and session changes; then implement the screens/hooks.
- [ ] Verify the full acceptance journey with two resident accounts and a
  non-resident regression case, including direct API requests to forbidden routes.
  Provision the two resident assignments by manually seeding trusted server data;
  no assignment management UI or endpoint is required for this feature.
- [ ] Run `pnpm check-types`, `pnpm test` and `pnpm fix` through the repository
  scripts/Nx; confirm actual test execution. Do not install dependencies; if a
  storage package is necessary, propose manifest changes for human installation.
- [ ] Add `.docs/api/resident-reports.md` and
  `.docs/frontend/resident-reports.md`; update auth/shell documentation and
  `.docs/README.md`. Mark this spec built only after verification.

## Out of scope

- Staff triage screens, status editing, internal notes and notifications.
- Resident access to other people's reports, estate directories or asset records.
- Public attachments, report editing/deletion, comments, AI classification and ML.
- A resident onboarding/assignment management UI or general custom-role system.
  Managers/admins assigning or revoking resident estate assignments belongs to
  a later feature. Manually seed assignments for the two acceptance-test
  residents; a trusted provisioning path remains a prerequisite for rollout.

## Agreed storage setup

The server will use the AWS S3-compatible SDK with `S3_ENDPOINT`, `R2_ACCESS_ID`,
`R2_SECRET_ACCESS_KEY` and `R2_BUCKET_NAME`. `R2_TOKEN` is reserved for
Cloudflare management/API operations unless the chosen setup requires it for
object access. Uploaded images are retained indefinitely with their reports;
only failed or abandoned uploads are cleaned up.

Implementation begins only after human agreement, per AGENTS.md rule 12 and
`.claude/commands/new-feature-spec.md`.
