# Invoices and service reports

Uploaded documents can also be [linked to assets](asset-documents.md). The asset
relation retains the document UUID/file and is independent of the
[work-order link](work-order-documents.md). Asset owners can link/unlink ordinary
uploads, including retired equipment, without a separate document-edit grant;
the existing read/download and deletion rules below still apply. Deleted uploads
disappear from both asset and work-order attachment lists.

Source of truth: `packages/api/openapi.json`. Files live in a private Google
Cloud Storage bucket (decision 0050); the browser sends and fetches bytes there
directly through short-lived signed URLs, and Spring owns the checks, signing
and Postgres metadata. Files are independent of assets and work orders.

| Method and path | Request | Success | Authorization |
| --- | --- | --- | --- |
| POST `/estates/{estateId}/documents/upload-slots` | JSON `DocumentUploadSlotRequest`: `fileName: string` (max 255), `contentType: string`, `size: int64` | 201 `UploadSlotResponse` | Current `EDIT_DOCUMENTS`, active estate |
| POST `/estates/{estateId}/documents` | JSON `CreateDocumentRequest`: `objectKey: string` (from the slot, after the PUT), `fileName: string`, `documentType: INVOICE \| SERVICE_REPORT` | 201 `DocumentResponse`, `Location` points to the content endpoint | Current `EDIT_DOCUMENTS`, active estate |
| GET `/estates/{estateId}/documents` | Optional query `filename: string` (trimmed, max 255), `documentType: INVOICE \| SERVICE_REPORT`, `cursor: string`, `limit: integer` (1–100, default 25) | 200 `DocumentPageResponse` | Current `VIEW_DOCUMENTS`, including inactive history |
| GET `/estates/{estateId}/documents/{documentId}/content` | UUID path parameters, no body | 200 `SignedDownloadResponse` (five-minute download link) | Current `VIEW_DOCUMENTS` |
| DELETE `/estates/{estateId}/documents/{documentId}` | UUID path parameters, no body | 204, no body | Current `EDIT_DOCUMENTS` and uploader or estate Manager/owner; inactive estates allowed |

`DocumentResponse` fields are required: `id: UUID`, `estateId: UUID`,
`documentType: INVOICE | SERVICE_REPORT`, `originalFilename: string`,
`contentType: string`, `sizeBytes: int32`, `createdAt: ISO-8601 datetime`,
`canDelete: boolean`. Private storage keys and uploader subjects are not exposed.
`DocumentPageResponse` has `items: DocumentResponse[]` and
`nextCursor: string | null`.

`UploadSlotResponse` (shared with inspections and resident reports):
`objectKey: string`, `uploadUrl: string`, `contentType: string`,
`maxBytes: int64`, `expiresAt: ISO-8601 datetime`, plus nullable
`inspectionId`/`reportId` (unset for documents). The browser sends the file with
`PUT uploadUrl`, headers `Content-Type: <contentType>` and
`x-goog-content-length-range: 0,<maxBytes>`; the URL is signed over both and
lasts ten minutes, so storage refuses any other type or a larger body.
`SignedDownloadResponse`: `url: string`, `expiresAt: ISO-8601 datetime`
(five minutes). Document links make storage answer with the validated type and
`Content-Disposition: attachment` carrying the original filename.

Owners and current same-estate Managers, Council and Crew receive read/write
document access. MEMBER/RESIDENT alone receive none. Custom roles need explicit
`VIEW_DOCUMENTS`; `EDIT_DOCUMENTS` requires it. Neither code requires general
estate management access. A conflicting same-estate RESIDENT membership denies
owner authority. JWT roles do not supply document powers. Missing identity is
401 even in local open-security mode; other-estate Managers gain no access.

All operations document 400 invalid request, 401 missing identity, 403 missing
authority, 404 inaccessible estate or missing/foreign document, 500 database
operation failure, and 503 unavailable storage (not configured, unreachable or
unable to sign: `File storage is temporarily unavailable. Try again later.`).
The slot and upload additionally document 409 inactive estate, 413 file too
large and 415 format mismatch. Upload answers 400 for a key with no file behind
it, a key not issued for this estate, or one already used by a document. Errors
handled by the controller use `EstateError { message: string }`; authentication
filter failures may have no JSON body. Deleted files return 404 on download.

Files must contain 1–5,000,000 bytes. Extensions `.pdf`, `.jpg`, `.jpeg`, `.png`
are case insensitive and must match the declared canonical media type and file
signature. Images must decode within 12,192,768 pixels, in either orientation.
Validation preserves the original bytes. PDF validation identifies its header;
it does not parse or render PDF contents. Path components are stripped from
display filenames; blank names, control characters and names over 255 characters
are rejected. The slot checks the declared name, type and size; the upload
re-checks the stored object's real size and type, then reads its bytes for the
signature and image checks.

Lists filter in Postgres before cursor pagination, excluding deletion markers.
The optional `documentType` filter combines with filename search using AND;
omitting it returns both existing types. Unsupported API type values return 400.
No additional document category is introduced, and size metadata remains in the API.
Filename search is a case-insensitive literal substring, including extension;
SQL wildcard characters are escaped by jOOQ. Ordering is descending
`createdAt`, then UUID. Cursors are bound to the estate, trimmed search and type.
Changing any active filter invalidates a cursor from the old result set. Existing
unfiltered cursors retain their format and remain usable when type is omitted.

Example: `GET /estates/{estateId}/documents?filename=lift&documentType=SERVICE_REPORT`
returns only service reports whose filename contains “lift”, applying both
constraints before page limits.
Metadata, slot and link responses use `Cache-Control: private, no-store`.

The slot picks the key `documents/{estateId}/{documentId}`; the document id in
the key becomes the row's id. Upload first rejects a key outside this estate's
prefix or already referenced (400, the object is left alone), then checks the
object (failures delete it), then locks the estate and rechecks current
permission/activity before inserting metadata. A failed commit deletes the
object. An auth or inactivity failure before the checks leaves the object for
the hourly sweep. Duplicate filenames create separate IDs. Storage is configured
by `app.storage.bucket` (`GCS_BUCKET_NAME`) and optional
`app.storage.project-id` (`GCS_PROJECT_ID`), authenticated by Application
Default Credentials; the bucket stays private. In dev only,
`app.storage.credentials-json` (`GCS_CREDENTIALS_JSON`, Infisical `/apps/server`)
holds an inline service-account key that replaces ADC and signs URLs locally;
prod leaves it unset and uses the Cloud Run identity. A malformed key answers 503.

Deletion locks estate then document and commits `deletedAt`/`deletedByUserId`
before attempting storage removal. Repeated authorized deletion preserves its first
audit actor/time. Failed commits leave the visible row and object intact. A 204
confirms platform removal; physical cleanup may be pending. The hourly worker
retries up to 100 pending deletions and examines every `documents/` object,
deleting unreferenced objects older than 24 hours (this also removes uploads that
were never confirmed). Successful physical
deletion records `storageDeletedAt`. This never sweeps resident `reports/` keys.

`GET /access/context` adds required estate booleans `canViewDocuments` and
`canUploadDocuments`; upload additionally requires activity. Document access
permits workspace entry. Per-document `canDelete` uses live edit permission
plus uploader-or-Manager authority independently of activity. The existing
role-permissions endpoint includes the two catalogue labels and edit prerequisite,
with existing bounded delegation rules.

Example: POST `{"fileName":"lift-report.pdf","contentType":"application/pdf","size":48213}`
to `/estates/{estateId}/documents/upload-slots`; PUT the file to `uploadUrl`
with the two headers; POST `{"objectKey":"documents/<estate>/<uuid>","fileName":"lift-report.pdf","documentType":"SERVICE_REPORT"}`
to `/estates/{estateId}/documents`; GET the returned `Location` for
`{"url":"https://storage.googleapis.com/...","expiresAt":"..."}` and open `url`. Search with `GET /estates/{estateId}/documents?filename=lift`.

Work-order linking/change/removal and attachment reads are documented in
[work-order-documents.md](work-order-documents.md). These require independent
work-order authority; uploader/delete rights do not grant association mutation.


## Development database / bucket isolation

The orphan sweep compares the configured bucket's entire `documents/` prefix
against the connected database's Document records. It does not discover other
Neon branches or treat branch-local metadata as a complete shared-bucket registry.
Independent databases sharing that prefix can therefore make each other's valid
objects appear unreferenced; objects older than 24 hours are eligible for deletion.
Pair the bucket/prefix with its authoritative database or coordinate storage
isolation before running this configuration long-term. The ID-26 QA pass recorded
this setup concern without changing ID-22's cleanup behaviour.
