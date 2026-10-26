# Invoices and service reports

Source of truth: `packages/api/openapi.json`. Spring owns private R2 access and
Postgres metadata. Files are independent of assets and work orders.

| Method and path | Request | Success | Authorization |
| --- | --- | --- | --- |
| POST `/estates/{estateId}/documents` | Multipart `UploadDocumentRequest`: `documentType: INVOICE \| SERVICE_REPORT`, exactly one binary `file` | 201 `DocumentResponse`, `Location` points to the content endpoint | Current `EDIT_DOCUMENTS`, active estate |
| GET `/estates/{estateId}/documents` | Optional query `filename: string` (trimmed, max 255), `cursor: string`, `limit: integer` (1–100, default 25) | 200 `DocumentPageResponse` | Current `VIEW_DOCUMENTS`, including inactive history |
| GET `/estates/{estateId}/documents/{documentId}/content` | UUID path parameters, no body | 200 original PDF/JPEG/PNG attachment | Current `VIEW_DOCUMENTS` |
| DELETE `/estates/{estateId}/documents/{documentId}` | UUID path parameters, no body | 204, no body | Current `EDIT_DOCUMENTS` and uploader or estate Manager/owner; inactive estates allowed |

`DocumentResponse` fields are required: `id: UUID`, `estateId: UUID`,
`documentType: INVOICE | SERVICE_REPORT`, `originalFilename: string`,
`contentType: string`, `sizeBytes: int32`, `createdAt: ISO-8601 datetime`,
`canDelete: boolean`. Private storage keys and uploader subjects are not exposed.
`DocumentPageResponse` has `items: DocumentResponse[]` and
`nextCursor: string | null`.

Owners and current same-estate Managers, Council and Crew receive read/write
document access. MEMBER/RESIDENT alone receive none. Custom roles need explicit
`VIEW_DOCUMENTS`; `EDIT_DOCUMENTS` requires it. Neither code requires general
estate management access. A conflicting same-estate RESIDENT membership denies
owner authority. JWT roles do not supply document powers. Missing identity is
401 even in local open-security mode; other-estate Managers gain no access.

All operations document 400 invalid request, 401 missing identity, 403 missing
authority, 404 inaccessible estate or missing/foreign document, 500 database
operation failure, and 503 unavailable storage. Upload additionally documents
409 inactive estate, 413 file/request too large and 415 format mismatch. Errors
handled by the controller use `EstateError { message: string }`; authentication
filter failures may have no JSON body. Deleted files return 404 on download.

Files must contain 1–5,000,000 bytes. Extensions `.pdf`, `.jpg`, `.jpeg`, `.png`
are case insensitive and must match the declared canonical media type and file
signature. Images must decode within 12,192,768 pixels, in either orientation.
Validation preserves the original bytes. PDF validation identifies its header;
it does not parse or render PDF contents. Path components are stripped from
display filenames; blank names, control characters and names over 255 characters
are rejected. Servlet limits separately reject oversized multipart requests.
Tomcat drains rejected bodies up to 20 MiB so ordinary over-limit requests can
receive the JSON 413 response; accepted request/file limits stay unchanged.

Lists filter in Postgres before cursor pagination, excluding deletion markers.
Filename search is a case-insensitive literal substring, including extension;
SQL wildcard characters are escaped by jOOQ. Ordering is descending
`createdAt`, then UUID. Cursors are bound to the estate and trimmed search.
Metadata responses use `Cache-Control: private, no-store`; downloads also use
`X-Content-Type-Options: nosniff`, the validated media type and a UTF-8 encoded
`Content-Disposition: attachment` filename.

Upload writes the UUID key `documents/{estateId}/{documentId}` to R2 before
opening the metadata transaction. It then locks the estate and rechecks current
permission/activity before inserting metadata. Failed writes or commits attempt
object cleanup; duplicate filenames create separate IDs. No transaction spans
the storage request. R2 uses the existing server-only `app.r2.*` configuration
(`S3_ENDPOINT`, `R2_ACCESS_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). The
production endpoint must use HTTPS and the bucket must remain private.

Deletion locks estate then document and commits `deletedAt`/`deletedByUserId`
before attempting R2 removal. Repeated authorized deletion preserves its first
audit actor/time. Failed commits leave the visible row and object intact. A 204
confirms platform removal; physical cleanup may be pending. The hourly worker
retries up to 100 pending deletions and examines at most 500 document-prefixed
objects, deleting unreferenced objects older than 24 hours. Successful physical
deletion records `storageDeletedAt`. This never sweeps resident `reports/` keys.

`GET /access/context` adds required estate booleans `canViewDocuments` and
`canUploadDocuments`; upload additionally requires activity. Document access
permits workspace entry. Per-document `canDelete` uses live edit permission
plus uploader-or-Manager authority independently of activity. The existing
role-permissions endpoint includes the two catalogue labels and edit prerequisite,
with existing bounded delegation rules.

Example: POST multipart `documentType=SERVICE_REPORT` and `file=@lift-report.pdf`
to `/estates/{estateId}/documents`, then GET the returned `Location` with a fresh
bearer token. Search with `GET /estates/{estateId}/documents?filename=lift`.

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
