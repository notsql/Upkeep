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
`document-row.tsx`, `document-filters.tsx` and `upload-document-form.tsx`.
`documents-page.tsx` composes `documents-results.tsx` (notice, loading/error,
list, pagination) and `documents-dialogs.tsx` (work-order, asset and delete
dialogs); `use-documents-page.ts` and `use-upload-document-form.ts` hold their
state and handlers. The
route validates `filename`, `documentType` and `cursor` URL search parameters,
so refresh/back restore filtering and paging.
Supported type values are `INVOICE` and `SERVICE_REPORT`; unsupported/empty URL
type values redirect to the same document list without a type constraint,
preserving filename and cursor. State remounts when the account or estate changes.

`DocumentFiltersForm` uses shared shadcn Select, Input, Label and Button
components. “Filter by type” offers All types, Invoice and Service report.
Changing type resets the cursor and preserves the active filename. Search
resets pagination while retaining type; the FilterBar's Clear filters (shown with
an "N active" badge when filename and/or type is set) removes both filters and the
cursor; selecting All types removes the type constraint. The shared `Pagination`
("Document pages") "Next page" / "Previous page" (back to the first page)
preserve both filters. The FilterBar is collapsed behind the header's
`FilterToggle` until opened (open on load when filters are in the URL). The browser
sends filters to the API, which applies them before pagination.

The `_auth` guard requires `canViewDocuments` from the authenticated access
projection before route entry. Live access comes from `useAppAccess`;
document-only custom roles need no management estate or member requests.
The page uses the projection's estate label and shows an access alert after
live revocation. Protected list queries are enabled only with document access.

UI uses shared shadcn Button, Card, Input, Label, Select, Table and Dialog.
The upload form is not inline: an "Upload document" button in the page header
(upload-capable users only) opens a Dialog holding the form. A confirmed upload
closes the dialog and the page announces the success; errors keep it open with
the selection. Escape/close is ignored while an upload is pending.
Upload accepts Invoice/Service report and a single file; help identifies
PDF/JPEG/PNG and 5 MB before submission. Client checks empty/type/size errors;
server validation remains authoritative. Pending submission disables repeat
actions and announces “Uploading…”. Confirmed 201 announces/toasts
`"{filename}" uploaded successfully.`, clears the file/type, closes the dialog and refreshes lists.
Errors retain selection. A transport failure explains unconfirmed completion and
asks the user to refresh the list before retrying. No upload auto-retries.

`apps/web/src/lib/documents.ts` owns every API call through the generated client:

| Hook | Endpoint | Query/mutation behavior |
| --- | --- | --- |
| `useDocumentAccess` | GET `/access/context` via `useAppAccess` | `[userId, "app-access"]`; derives estate label/read/upload capability |
| `useDocuments` | GET `/estates/{estateId}/documents` | `[userId, "documents", estateId, filters]`, filename/documentType/cursor query, abort signal, no retry |
| `useUploadDocument` | POST `/estates/{estateId}/documents` | FormData `documentType` + one `file`; accepts only confirmed 201; no retry |
| `useDownloadDocument` | GET `/estates/{estateId}/documents/{documentId}/content` | `parseAs: "blob"`, authenticated client, temporary object URL clicked then revoked 1 s later (Safari cancels the save if revoked in the same task); no retry |
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
unlinked state; the error is `ErrorState` whose Retry is named "Retry asset
link for <file>" (`retryAriaLabel`). Without asset-read access, the cell shows a dash and makes no
association request. Read-only/inactive access retains existing asset links
without write controls.
API `sizeBytes` metadata and upload size validation remain available.

The list includes download actions, newest-first
cursor navigation and distinct “No documents yet”/“No matching documents”
messages. The no-matches state applies when either filename or type is
active. Clear filters clears both; All types clears the type filter. Read-only/inactive
access hides upload. Delete appears only when the server's per-row `canDelete`
is true; inactivity alone does not remove an otherwise authorized delete action.
Confirmation names the file; Cancel sends no request. Pending confirmation
disables duplicate submission. Denial/failure stays in the dialog for explicit
retry. Confirmed deletion announces/toasts `"{filename}" removed` and closes the
dialog, without claiming immediate physical erasure from R2.

The sidebar shows Assets › Documents based on `canViewDocuments`. There is
no global Documents chooser; the header feature switcher preserves document context when possible and
supports document-only accounts without management endpoint calls.

Work-order row actions, association dialogs and history are described in
[work-order-documents.md](work-order-documents.md). The action requires both
document and work-order read capabilities; writes remain Owner/Manager-only.

## Responsive document list

`-components/documents-page/document-list.tsx` uses the existing `useMobile` media query:
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

## Screen states

`document-filters.tsx` renders a `FilterBar` (`search` landmark "Filter
documents"): filename search grows, "Filter by type" is `w-full sm:w-48` with a
full-width trigger, Search (outline) is the only action; `activeCount`/`onClear`
give the header badge and ghost Clear filters. `DocumentList` takes
`onClearFilters`: no matches shows the "No matching
documents" `EmptyState` with Clear filters; an empty estate shows
"No documents yet" ("Uploads appear here", no action - the header Create opens
the upload dialog). Access, list, picker, link and history loads use `LoadingState`.

## Design-system pass

PageHeader `icon={Files}`. Row actions (Unlink, Work order, Download, Delete) are
`ghost` buttons; Delete still opens the "Delete file" confirmation whose confirm
is `destructive`. The work-order picker's Search work orders is `outline`.

## Shared page components

`DocumentsPage` uses `ListPageHeader` (`icon={Files}`, `filters` =
`FilterToggle`, `create` = `CreateButton` "Create" with `onClick` opening the
upload dialog, only with upload permission). `UploadDocumentForm` is now a
controlled `FormDialog` (`open`, `onClose`, `onUploaded`): title "Upload a
document", submit "Upload" / "Uploading…", errors via `error`, plus an sr-only
`role="status"` "Uploading…" while pending. `countDocumentFilters` in
`document-filters.tsx` gives `activeCount`; `DocumentFiltersForm` takes
`id`/`open` from `useFilterPanel`. Delete confirmation is the shared
`ConfirmDialog` ("Delete file", pending "Deleting…", mutation error via `error`).
List, association-history, asset-link, work-order-picker and asset-picker load
failures use `ErrorState` (the per-row asset-link error names the file in its
message). `document-asset-dialog.tsx` and `document-work-order-dialog.tsx` stay
hand-built Dialogs: their footers switch between Unlink/Save link with a
conditional disabled state, and the work-order dialog nests the picker's own
`<form>`, which `FormDialog`'s form cannot contain.
