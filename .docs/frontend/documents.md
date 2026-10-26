# Estate documents

Route `/estates/$estateId/documents` lives at
`apps/web/src/routes/_auth/estates/$estateId/documents/index.tsx`. Its
`-components/` folder contains `documents-page.tsx` and
`upload-document-form.tsx`. The route validates `filename` and `cursor` URL
search parameters, so refresh/back restore search and paging. Search/Clear reset
the cursor. State remounts when the account or estate changes.

The `_auth` guard requires `canViewDocuments` from the authenticated access
projection before route entry. Live access comes from `useAppAccess`;
document-only custom roles need no management estate or member requests.
The page uses the projection's estate label and shows an access alert after
live revocation. Protected list queries are enabled only with document access.

UI uses shared shadcn Button, Card, Input, Label, Select, Table and Dialog.
Upload accepts Invoice/Service report and a single file; help identifies
PDF/JPEG/PNG and 5 MB before submission. Client checks empty/type/size errors;
server validation remains authoritative. Pending submission disables repeat
actions and announces “Uploading…”. Confirmed 201 announces/toasts
`"{filename}" uploaded successfully.`, clears the file/type, and refreshes lists.
Errors retain selection. A transport failure explains unconfirmed completion and
asks the user to refresh the list before retrying. No upload auto-retries.

`apps/web/src/lib/documents.ts` owns every API call through the generated client:

| Hook | Endpoint | Query/mutation behavior |
| --- | --- | --- |
| `useDocumentAccess` | GET `/access/context` via `useAppAccess` | `[userId, "app-access"]`; derives estate label/read/upload capability |
| `useDocuments` | GET `/estates/{estateId}/documents` | `[userId, "documents", estateId, filters]`, filename/cursor query, abort signal, no retry |
| `useUploadDocument` | POST `/estates/{estateId}/documents` | FormData `documentType` + one `file`; accepts only confirmed 201; no retry |
| `useDownloadDocument` | GET `/estates/{estateId}/documents/{documentId}/content` | `parseAs: "blob"`, authenticated client, temporary object URL downloaded then revoked; no retry |
| `useDeleteDocument` | DELETE `/estates/{estateId}/documents/{documentId}` | Requires confirmed 204, no retry |

Upload and deletion invalidate `[userId, "documents", estateId]`, covering every
cached filename search/page. Refresh errors are displayed independently with
Retry and never turn a completed mutation into failure. Query keys prevent
account/estate cache sharing; the existing session hook clears old-account data.
Frontend DTOs are aliases of generated OpenAPI types.

The list shows filename/type/byte size/time, download actions, newest-first
cursor navigation and distinct “No documents uploaded”/“No files match your
search” messages. Clear search is available while filtering. Read-only/inactive
access hides upload. Delete appears only when the server's per-row `canDelete`
is true; inactivity alone does not remove an otherwise authorized delete action.
Confirmation names the file; Cancel sends no request. Pending confirmation
disables duplicate submission. Denial/failure stays in the dialog for explicit
retry. Confirmed deletion announces/toasts `"{filename}" removed` and closes the
dialog, without claiming immediate physical erasure from R2.

Desktop and estate navigation show Documents based on `canViewDocuments`.
Outside a document estate, the Documents chooser offers authorized estates.
The existing feature switcher preserves document context when possible and
supports document-only accounts without management endpoint calls.

Work-order row actions, association dialogs and history are described in
[work-order-documents.md](work-order-documents.md). The action requires both
document and work-order read capabilities; writes remain Owner/Manager-only.
