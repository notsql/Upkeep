# 0036 — Private estate documents and durable deletion

Date: 2026-10-25. Status: accepted through the invoice/service-report spec and
implementation request.

Invoices and service reports share a separate Document table and private R2
`documents/` prefix. Resident report images retain their existing table and
`reports/` prefix. Documents preserve original bytes; they are not re-encoded or
associated with work orders/assets in this feature.

The browser sends a single multipart file through the generated client to
Spring. Spring validates it, stages an R2 UUID key outside a transaction, then
locks the estate and rechecks current permission and activity before committing
metadata. Failed submissions attempt object cleanup; a bounded hourly sweep
removes old unreferenced document objects after 24 hours.

Deletion commits an audited marker under estate-then-document locks before
requesting physical R2 removal. The retained row is the durable retry record;
`storageDeletedAt` confirms completion. The API returns 204 for committed platform
removal even if R2 cleanup must retry. This avoids deleting bytes from a still
visible document when a database commit fails. Repeated authorized deletion
preserves the original audit actor/time.

VIEW_DOCUMENTS and EDIT_DOCUMENTS are explicit custom-role grants; edit requires
read. Both cover invoices and service reports. Existing owner/Manager, Council
and Crew presets retain document powers. Deleting another uploader's file still
requires estate Manager authority. Read access alone supports workspace entry,
navigation and the Documents screen without granting management endpoint access.

The servlet upload limits remain 5 MiB per file and 17 MiB per request;
application validation enforces the exact 5,000,000-byte file cap. Tomcat drains
up to 20 MiB of rejected request bodies to deliver actionable JSON 413 responses
for ordinary over-limit submissions rather than resetting an in-flight upload.
The drain bound does not increase accepted file or request limits.

See [feature spec](../features/invoice-service-report-uploads.md),
[API](../../.docs/api/documents.md) and
[frontend](../../.docs/frontend/documents.md).
