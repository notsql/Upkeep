# Work-order document association (ID-26)

API: [work-order-documents.md](../api/work-order-documents.md).

Documents can independently [link to an asset](asset-documents.md). Both server
association write paths reject different non-null document/work-order asset IDs
with 409, which uses this dialog's existing refresh/review recovery. Removing the
asset relation preserves the work-order link, file and audit history.
No new URL route is required: the existing Documents list and work-order detail
are extended. UI uses folder routes and shared shadcn components.

## Screens and component ownership

`routes/_auth/estates/$estateId/documents/-components/`:

- `documents-page.tsx`/`document-row.tsx`: a Work order action labelled
  Work-order link for <filename>, only with both document and work-order read access.
- `document-work-order-dialog.tsx`: scrollable shadcn Dialog, current link/author/time,
  read/access feedback and composition of the smaller sections below.
- `use-document-work-order-dialog.ts`: draft selection/reason, captured reviewed
  version, in-flight guard, save/refresh/review and close handling.
- `work-order-picker.tsx`: shadcn Input/Select/Table/Button; partial reference,
  optional status (All includes Closed), search and Next/First page. Selection is
  retained outside the picker during searches and paging.
- `association-editor.tsx`: link/change/remove confirmation; labelled required
  correction reason, explicit Save link/Confirm removal and Cancel changes.
- `association-history.tsx`: chronological previous/new references, reason and
  author/time with history paging/retry. Name unavailable replaces missing names.
- `association-recovery.tsx`: structured shadcn Alerts for failed saves/conflicts,
  refresh feedback and explicit review of updated association state.

`routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/` adds
`work-order-documents.tsx`, a Card/Table section of current attachments, file
metadata, authenticated Download, empty/loading/retry feedback and cursor paging.
It mounts only with document read permission and work-order access; its instance
is scoped to user/estate/order. It reuses ID-22's typed Blob download hook. Deleted
files disappear on refetch/invalidation; no document blob cache or public file URL
is introduced.

## Permissions and recovery

`useWorkOrderDocumentAccess` derives current read access from authenticated session,
ID-22 `canViewDocuments` and `canViewWorkOrders`. Writes additionally require
`canUpdateWorkOrders` and `canUploadDocuments` (active Owner/Manager plus document
edit authority). These flags control UI; the API independently checks live authority.
Crew get read-only current link/history without picker or write actions. Council/
custom users with document access alone get no association action or work-order
query. Inactive estates retain reads with writes hidden.

A draft captures association version and prior target when editing begins or the
first order is selected. Background data never silently updates that reviewed
version. Reassignment/removal requires a reason and keeps existing job outcome/costs.
Cancel changes does not mutate. Pending saves disable controls/close and have an
immediate in-flight guard. Failed reads suppress cached denied/deleted content;
transient refresh failures retain the draft and offer retry. Conflict/uncertain
save recovery reloads association and current history together and requires
I reviewed the updated link before retrying; refresh never auto-submits a save.
Validation errors (400) remain directly correctable. A lost response explains that
the save could not be confirmed and requires refresh/review before another attempt.

## Hooks, endpoint calls and keys

`lib/work-order-documents.ts` uses only generated API DTOs/client types:

| Hook | Endpoint / behaviour |
| --- | --- |
| useDocumentAssociation | GET document work-order; `[userId, "documents", estateId, "association", documentId]` |
| useDocumentAssociationHistory | GET document work-order/history; `[userId, "documents", estateId, "association-history", documentId, cursor]` |
| useWorkOrderDocuments | GET work-order documents; `[userId, "documents", estateId, "work-order-attachments", workOrderId, cursor]` |
| useChangeDocumentAssociation | PUT document work-order with generated request, previous target retained as local invalidation context; no retry |

Queries require both read capabilities, pass AbortSignal, throw returned API errors
and disable automatic retries. Authorization/unavailable responses refresh the
user's app-access context. The picker reuses `lib/work-orders.ts` list keys/API;
read-only Crew never mount it. Hooks do not request owner-only asset APIs.

Success seeds association detail and invalidates the affected document's history
and former/new order attachment pages. All document keys share ID-22's
`[userId, "documents", estateId]` prefix, so confirmed upload/delete invalidation
also refreshes this feature. Linking does not invalidate job completion, cost,
asset maintenance, forecasts or fault reports because those records are unchanged.
Existing session cleanup isolates identities; document-page remount isolates estates.

## Manual review

1. As Owner/Manager, open Documents, upload or choose an existing file and open
   its Work order action. Search/select a Closed order; save. Verify reference,
   attachment on the order and one initial audit event; reload both screens.
2. Change the target with a reason. Confirm it moves between attachment lists,
   while previous/new references and reason/actor/time remain in history.
3. Remove the link with a reason; the stored document/download remains available.
4. Save from two tabs using an older version. Confirm stale rejection, retained
   draft, refresh of link/history and explicit review before another save.
5. Check Crew read-only access, document-only Council/custom denial of association
   reads/actions, Resident denial, and no owner-only asset permission required.
6. Delete a linked file as an ID-22-authorized uploader/Manager. Refresh the order:
   attachment disappears while status/outcome/costs remain unchanged. A stale
   association read/save must not bring the deleted document back.
7. Check long filenames/references, 320/390px portrait, landscape dialog scrolling,
   light/dark themes, keyboard focus, error/retry and history/document pagination.

Extraction/verification and real document-asset mismatch integration remain
explicit follow-ups until ID-23/24/25 expose their fields. No fabricated findings
or auto-applied invoice costs appear in this UI.

## Live QA record (2026-10-26)

Completed locally with real AuthKit authentication, a disposable migrated Postgres
and temporary local S3-compatible storage. Owner upload/link actions used actual
forms and HTTP endpoints. Additional estate-role fixtures were seeded for that
same authenticated account, with no invitations or external messages sent.
No shared Neon database or shared bucket was changed. This verifies application
flows and file bytes, not the Cloudflare R2 provider itself.

| Check | Result |
| --- | --- |
| Owner uploads a sample PDF, selects a Closed job and sees current link/audit | Passed |
| Browser downloads the attachment from work-order detail | Passed; both downloaded files exactly match the original 610-byte PDF |
| Blank correction reason, reasoned reassignment, old/new attachment lists | Passed; blank reason prevented saving and the file moved between jobs |
| Reasoned removal and file retention | Passed; authorized content remained available with matching SHA-256 |
| Two real tabs change the same link | Passed; stale write rejected, draft retained, no extra audit event, refresh updated history, explicit review required before retry |
| Linked-file deletion and stale save afterward | Passed; current attachment/content hidden, future association reads/saves return 404, refresh suppresses deleted link |
| Internal audit and storage cleanup after deletion | Passed; all six association events retained, version unchanged by deletion, local object removed |
| Work-order/completion/cost/status-event preservation | Passed; database snapshots unchanged throughout linking, corrections/removal and deletion |
| Non-owner Manager linking/correction without asset-register access | Passed in UI and live authority checks |
| Crew link/audit/attachment reads without write/lifecycle controls | Passed in UI and API; attempted association mutation returned 403 |
| Council/document-only custom role document viewing | Passed; ID-22 file access retained, association controls absent and API association reads/writes denied |
| Resident direct document/work-order URLs | Passed; Page not found, no private metadata; API reads/writes denied |
| All four association operations without identity | Passed; 401 |
| Picker pagination, empty search, retained selection and Cancel | Passed with 22 work orders; selection survived paging/search and Cancel preserved link/version |
| Mobile and keyboard | Passed at 320/390px portrait and 844×390 landscape; dialog/table scrolling, light/dark, accessible footer, Escape and focus return |

A failed upload retained the selected file and displayed retry feedback. The
initial storage failure was in the temporary QA emulator's signed-chunk decoding;
fixing that helper allowed retry without application changes. The interrupted
sign-in session also required a fresh OAuth redirect before resuming.

Minor upstream display issue for discussion: ID-22's upload-type selector shows
raw `INVOICE` after selection, while its menu/table use Invoice. Proposed follow-up:
provide the existing shadcn Select with label/value items and add a failing label
regression before changing it. No application code was changed by this QA pass.

The automated suite previously passed with 1,206 server and 658 web tests; it was
not rerun for these documentation-only updates. That local pass did not verify
Cloudflare R2; the subsequent Neon/R2 pass below covers the provider.
Extraction/verification and document-asset checks retain their
separate ID-23/24/25 dependency boundaries. The disposable database and temporary QA services were removed;
screenshots/helpers remain outside the repository. One matching sample PDF remains
in Windows Downloads because another process has the file open; it was not forced
closed or removed.


## Persistent Neon / real R2 review (2026-10-26)

At the user's request, used their already running `pnpm dev`, current migrated
Neon development branch and real R2 configuration. No replacement app/database
was started and no migrations were applied by the agent. All test writes went
through the real application API/UI; database inspection was read-only.

Created a labelled `ID26 QA Demo - 26 Oct` estate (`QA-ID26-DEMO`) under the QA
window's signed-in account, with QA Block A/L1 and two sample manual work orders:
`QA-ID26-DEMO-W0001` stays Open; `QA-ID26-DEMO-W0002` is Closed with a manually
entered SGD 12.50 outcome. These are QA examples, not actual contractor work or
extracted invoice data. Records were deliberately retained for user inspection.

- Uploaded `QA-ID26-invoice.pdf` (630 bytes) and `QA-ID26-service-report.pdf`
  (634 bytes) through Documents. R2 confirmed the invoice object exists.
- Initially linked the invoice to W0001, then corrected it to W0002 with a reason;
  both audit events remain visible. The service report links directly to W0002.
  The completed work order shows both attachments.
- Downloaded both PDFs through the actual work-order screen. Browser downloads
  and authorized file responses exactly match original bytes/SHA-256.
- Uploaded a 123-byte PNG and linked it to the Open order as a separate deletion
  check. Confirmed its actual R2 object existed (HEAD 200), deleted only that QA
  file through Documents, and confirmed R2 HEAD 404 and content API 404 afterward.
- Compared read-only database snapshots before/after association operations:
  work orders, completion/outcome/costs and status events are unchanged.
- Left the user's app running and the completed demo order open in QA Chrome.
  Both PDFs and work orders remain in Neon/R2; only the throwaway PNG was removed.

Setup concern recorded for coordination, without changing code/configuration:
before these uploads, the configured R2 bucket already contained three document
objects not referenced by this Neon branch. None was older than 24 hours during
inspection and none was changed. ID-22's hourly orphan sweep would consider them
for deletion once older than 24 hours; they could be valid files from another
Neon branch. A branch-local database and a shared bucket therefore need coordinated
ownership/isolation before leaving this setup running long-term. See the document
API's storage isolation note. The minor raw upload-type label also remains a
proposed upstream UI follow-up; neither issue was silently fixed during QA.


Additional user-reported finding after the persistent demo review: long estate
names expand the sidebar navigation grid/estate trigger beyond its padded width.
Reproduced in Chrome with the demo name and longer names; temporary inspector
constraints confirmed the sizing cause and were restored. After user agreement, a
failing browser assertion was recorded (1,942px selector inside 199px available).
The fixed navigation grid and shrinkable trigger now keep the same long label
inside 199px, truncate selected estate/role labels, retain full accessible text and
bound/wrap opened menu names.


Resident-switching UX observation: the current shared switcher deliberately opens
Report a fault for Resident estates. The user finds this surprising when browsing
Crew work orders/Documents. After user agreement, browsing selections now open estate-scoped My reports.
Explicit Report a fault actions keep the estate preselected, and switching estates
inside the report form preserves creation intent. The history API filters before
pagination and rejects scope-mismatched cursors; former-resident history stays owned/readable.
See [resident-reports.md](resident-reports.md) for the updated routes, query keys
and detail/return-link context. Crew work-order and Document switches to a Resident
were also clicked through in the live browser; the 320px history page fits without
horizontal overflow.


Follow-up verification after the approved sidebar/Resident navigation changes:
1,209 backend tests and 666 web tests passed, alongside types, formatting/lint and
production web build. A 200-character unbroken selected name now stays inside the
199px sidebar column; long menu names/custom roles fit the 320px viewport. The
new history header also wraps unbroken names without widening the page. Existing
Resident report history tests moved beside the extracted route component in
`tests/routes/_auth/reports/-components/my-reports-page.test.tsx` without removing
assertions. Scoped history/detail/return links, user/estate pagination reset,
creation intent and unavailable-reporting/history access have regression coverage.
