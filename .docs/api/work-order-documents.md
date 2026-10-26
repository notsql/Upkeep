# Work-order document association (ID-26)

Contract source: `packages/api/openapi.json`, generated from
`WorkOrderDocumentController`. This extends ID-22's stored documents; it does not
upload files, extract invoice data or edit completion outcomes.

## Access and errors

Every endpoint requires authenticated identity, including local open-security
mode. Reads require both current work-order read access and `VIEW_DOCUMENTS` in
the estate. Thus permitted Crew can read attachments/history; document-only
Council/custom roles gain no work-order access. Writes additionally require an
active estate, current Owner/Manager authority and `EDIT_DOCUMENTS`. Document
edit/uploader/delete rights alone grant no association-write authority. Resident
override and live estate membership rules apply. Asset-register access is not
required. Reads remain available in inactive estates.

Association writes enforce Owner/Manager authority separately from work-order
creation access. Crew can read work orders and permitted attachments,
but linking, changing or removing a document association returns 403.

Responses use `Cache-Control: private, no-store`. Errors use
`EstateError { message: string }`: 400 invalid target/version/reason/cursor/limit;
401 missing identity; 403 missing document or work-order authority; 404 inaccessible
estate or missing/foreign/deleted document/work order; 409 inactive write or stale
association version; 500 persistence failure. Authentication filters may return
401 without JSON. No storage key or uploader subject is exposed.

## Endpoints and DTOs

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/estates/{estateId}/documents/{documentId}/work-order` | UUID path parameters | 200 DocumentWorkOrderResponse, including unlinked state |
| PUT | `/estates/{estateId}/documents/{documentId}/work-order` | ChangeDocumentWorkOrderRequest | 200 DocumentWorkOrderResponse |
| GET | `/estates/{estateId}/documents/{documentId}/work-order/history` | Optional opaque cursor, limit: integer 1–100, default 25 | 200 DocumentWorkOrderEventPageResponse |
| GET | `/estates/{estateId}/work-orders/{workOrderId}/documents` | Optional opaque cursor, limit: integer 1–100, default 25 | 200 ID-22 DocumentPageResponse |

`ChangeDocumentWorkOrderRequest`:

- `workOrderId: UUID | null`, required key. Explicit null removes the association;
  omission returns 400, preventing accidental unlinking.
- `expectedAssociationVersion: integer >= 0`, required; fractional/string values
  are rejected rather than coerced.
- `correctionReason?: string`, maximum 500 characters, trimmed. Required/nonblank
  when changing/removing an existing link. Initial links need no reason.

`DocumentWorkOrderResponse`:

- `documentId: UUID`, `associationVersion: integer`, required.
- `workOrderId?: UUID | null`, `workOrderReference?: string | null`.
- `changedByName?: string | null`, `changedAt?: ISO-8601 timestamp | null`.

`DocumentWorkOrderEventResponse`:

- `id: UUID`, `associationVersion: integer`, `changedAt: ISO-8601 timestamp`, required.
- `fromWorkOrderId?: UUID | null`, `fromWorkOrderReference?: string | null`.
- `toWorkOrderId?: UUID | null`, `toWorkOrderReference?: string | null`.
- `correctionReason?: string | null`, `changedByName?: string | null`.

`DocumentWorkOrderEventPageResponse` contains required `items: DocumentWorkOrderEventResponse[]`
and optional/nullable `nextCursor: string | null`. History is chronological by
association version; cursors are scoped to kind, estate and document.

The attachment page reuses [ID-22 DocumentResponse/DocumentPageResponse](documents.md).
It returns current nondeleted files, newest upload first with descending UUID
ties; cursors are scoped to kind, estate and work order. A history cursor cannot
be used for attachments, or a cursor reused against another document/job.

## Consistency, audit and lifecycle

A document links to at most one same-estate work order. Open/In Progress/Closed
jobs remain eligible; historical jobs do not require an active linked asset or
location. Successful uploaded documents need no extraction/verification. ID-25's
document asset field is absent; the agreed conflicting-asset policy must be
integrated when that real relation exists, without fabricating an asset field.

Writes lock the estate then document, matching ID-22 deletion. Version must match
the reviewed `Document.workOrderAssociationVersion`. A real change appends one
`DocumentWorkOrderEvent` and updates link/version in one transaction. A stale
request returns 409 even if it repeats an earlier successful save; refresh lets
the user inspect the saved link. An unchanged target with the current version is
a no-op, preserving version/audit. Automatic retries are not used.

Composite foreign keys prevent foreign-estate relations. Audit stores the actor
subject plus an optional display-name snapshot obtained before the write
transaction. User interfaces show Name unavailable when a name cannot be resolved.
Linking/reassignment/removal does not change WorkOrder version/status, completion,
revision/status history, source reports, asset condition or maintenance/cost entries.
Removing a link preserves the file and document record.

ID-22-authorized deletion remains allowed while linked. Marked files disappear
from attachment lists; association/history reads and future writes return 404.
The internal link/audit survive because deletion retains the row. Physical R2
cleanup continues through ID-22. Concurrent linking/deletion serializes on the
same locks and cannot resurrect platform file access.

Example: PUT an initial link with
`{"workOrderId":"<same-estate UUID>","expectedAssociationVersion":0}`.
A later removal sends
`{"workOrderId":null,"expectedAssociationVersion":1,"correctionReason":"Wrong job selected"}`.
Download through ID-22's authenticated `/documents/{documentId}/content` endpoint.
