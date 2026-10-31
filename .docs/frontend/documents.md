# Estate documents

The Asset column shows Associate Asset for an unlinked file when the user can
edit asset associations. Linked files show the asset reference and name as a
link to its detail page, with an Unlink button for asset editors that opens the
confirmation directly. The confirmation identifies the document and asset and
explains that the file and work-order link are retained; Cancel makes no change.
Its searchable/filterable picker and unlink confirmation are described
in [asset-documents.md](asset-documents.md).
This authority is independent of upload/edit permission. The linked file appears
in the asset detail Documents card; both views share estate document invalidation.

Route `/estates/$estateId/documents` lives at
`apps/web/src/routes/_auth/estates/$estateId/documents/index.tsx`. Its
`-components/` folder contains `documents-page.tsx`, `document-list.tsx`,
`document-row.tsx`, `document-filters.tsx` and `upload-document-form.tsx`. The
route validates `filename`, `documentType` and `cursor` URL search parameters,
so refresh/back restore filtering and paging.
Supported type values are `INVOICE` and `SERVICE_REPORT`; unsupported/empty URL
type values redirect to the same document list without a type constraint,
preserving filename and cursor. State remounts when the account or estate changes.

`DocumentFiltersForm` uses shared shadcn Select, Input, Label and Button
components. “Filter by type” offers All types, Invoice and Service report.
Changing type resets the cursor and preserves the active filename. Search and
Clear search reset pagination while retaining type; selecting All types removes
the type constraint. Next and First page preserve both filters. The browser
sends filters to the API, which applies them before pagination.

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
| `useDocuments` | GET `/estates/{estateId}/documents` | `[userId, "documents", estateId, filters]`, filename/documentType/cursor query, abort signal, no retry |
| `useUploadDocument` | POST `/estates/{estateId}/documents` | FormData `documentType` + one `file`; accepts only confirmed 201; no retry |
| `useDownloadDocument` | GET `/estates/{estateId}/documents/{documentId}/content` | `parseAs: "blob"`, authenticated client, temporary object URL downloaded then revoked; no retry |
| `useDeleteDocument` | DELETE `/estates/{estateId}/documents/{documentId}` | Requires confirmed 204, no retry |

Upload and deletion invalidate `[userId, "documents", estateId]`, covering every
cached filename/type filter and page. Refresh errors are displayed independently with
Retry and never turn a completed mutation into failure. Query keys prevent
account/estate cache sharing; the existing session hook clears old-account data.
Frontend DTOs are aliases of generated OpenAPI types.

The list shows Filename, Type, Uploaded, Asset and Actions, with no Size column or size
cells. `DocumentRow` accepts `showSize` (default true); this page passes false,
while the asset Documents table retains its Size header and matching cells.
`document-assets.tsx` loads each visible row's association through
`useDocumentAsset`, sharing the existing account/estate/document query key and
mutation invalidation. Pending/error reads show loading/Retry rather than an
unlinked state. Without asset-read access, the cell shows a dash and makes no
association request. Read-only/inactive access retains existing asset links
without write controls.
API `sizeBytes` metadata and upload size validation remain available.

The list includes download actions, newest-first
cursor navigation and distinct “No documents uploaded”/“No files match your
search” messages. The no-matches state applies when either filename or type is
active. Clear search is available for filename filtering; All types clears the
type filter. Read-only/inactive
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

## Responsive document list

`-components/document-list.tsx` uses the existing `useMobile` media query:
under 768px it renders a labelled `Documents` list of shadcn Cards; desktop keeps
a semantic table labelled Documents. Both use the existing page query result.
Cards show the full wrapping filename, type, uploaded time and asset association;
the estate list omits Size on both desktop and mobile. `DocumentActions` in
`document-row.tsx` is shared by both presentations:
download stays disabled while pending, association is offered only with existing
document/work-order read access, and Delete still depends on per-row `canDelete`.
The same page-level dialogs, errors, mutations and invalidations handle all
mobile actions; no second list request or hidden duplicate controls are added.
Filename/type filters and cursor paging remain URL-backed; pagination buttons wrap.
