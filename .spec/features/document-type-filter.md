# Document type filtering and a smaller Documents table

**Status:** built and verified on 2026-10-27; approved by the user before implementation
**Owner:** unassigned

## Problem

The estate Documents page shows a Size column the user does not need, and its
filename search cannot narrow results by document type. The user requested
removing Size and adding type filtering. The initial request to add an “Others”
type was explicitly withdrawn; this change uses the two existing types only.

## Behaviour

1. `/estates/$estateId/documents` shows Filename, Type, Uploaded and Actions.
   The Size header and corresponding row cells are removed from this page.
2. A labelled shadcn type filter offers All types, Invoice and Service report.
   All types is the default and sends no document-type constraint.
3. Invoice selects `INVOICE`; Service report selects `SERVICE_REPORT`.
   The server applies the type filter before pagination, together with the
   existing estate, nondeleted-document and filename predicates.
4. Filename and type filters combine with AND. Changing the type resets the
   pagination cursor while preserving filename search. Submitting or clearing
   filename search resets the cursor and preserves the selected type.
5. The selected type is stored in the `documentType` URL search parameter.
   Reload, direct links and browser back/forward restore it. URL validation
   accepts existing type values and omits empty/unsupported filter values;
   unsupported API query values still return 400.
6. Next and First page retain both filters. Pagination cursors are bound to
   estate, normalized filename and document type; a cursor cannot be reused
   after changing type. Existing unfiltered cursors remain usable for All types.
7. An empty filtered result uses the existing no-matches state; an unfiltered
   empty estate retains “No documents uploaded”. Loading, Retry, upload,
   download, deletion and association controls retain their existing policies.
8. Query keys include the generated filter object and the existing user/estate
   prefix. Upload/deletion invalidation refreshes all type-filtered pages.

## Data

No Prisma schema change, migration, new column, new index or new document type.
`Document.documentType` and its existing database constraint remain unchanged.
Filtering uses the existing field in the server's jOOQ query.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/documents` | Existing filename/cursor/limit; add optional `documentType: INVOICE \| SERVICE_REPORT` | Existing `200 DocumentPageResponse`; metadata, including `sizeBytes`, unchanged | Existing current `VIEW_DOCUMENTS` authority |

Keep existing error contracts: 400 for unsupported type or invalid/mismatched
cursor, 401 for missing identity, 403 for denied document authority and 404 for
an inaccessible estate. Continue private/no-store responses and inactive-estate
historical reads. Extend cursor binding only when a type is selected so existing
unfiltered cursors retain their format. Regenerate `packages/api/openapi.json`
and `packages/api/src/schema.ts`; frontend filter types come from that contract.

## Frontend

Keep the existing folder route and route-local components under
`apps/web/src/routes/_auth/estates/$estateId/documents/`. Add the shadcn Select
beside filename search, wire it through the route search state and `useDocuments`,
and preserve both filters through search, clearing and pagination.

`DocumentRow` is also used by the asset Documents section. Add a small explicit
display option so the estate Documents page can omit Size without misaligning
the asset table's existing headers/cells. No API size metadata is removed.

## Tests and verification

Write and run failing tests before implementation:

- Server HTTP tests cover each existing type, default All types, combined
  filename/type matching, filtering before page limits, cursor isolation by
  type, invalid type values, deleted/foreign records and unchanged authorization.
- Web tests cover filter options, request and URL values, reload restoration,
  cursor reset on type/search changes, retaining type when clearing filename,
  pagination, filtered empty states and account/estate cache isolation.
- Table tests verify the Documents page has no Size header or cells and that
  shared attachment tables retain their existing column alignment.

After green: run API generation, relevant Nx targets, `pnpm check-types`,
`pnpm test` and `pnpm fix`. Update `.docs/api/documents.md`,
`.docs/frontend/documents.md` and any affected attachment documentation.
Leave all changes uncommitted.

### Verification results

- Observed 10 failing HTTP cases before implementing server filtering and cursor
  binding. All 10 now pass against disposable, migrated Testcontainers Postgres.
- Observed the new UI failures before implementing the filter and column changes.
  All 54 document-page/asset-attachment cases pass, including retained shared
  Size cells, search/type combinations, URL restoration, invalid URL cleanup,
  paging and filtered empty states.
- `pnpm api:generate` regenerated both contract files. The document list adds
  only its optional type query parameter; response fields and allowed types are
  unchanged. No database schema change or migration was needed.
- `pnpm check-types`, `pnpm test` and `pnpm fix` passed. The full suite ran
  1,425 Java tests and 815 web tests with no failures.
- Updated `.docs/api/documents.md`, `.docs/frontend/documents.md` and their
  index. All code, tests, generated contract files and docs remain uncommitted.

## Edge cases

- Searching by filename while changing type must not silently clear either
  active filter or reuse a cursor from the previous result set.
- Changing to All types resets pagination and removes the type constraint.
- A matching document beyond the unfiltered first page must still appear in
  the first filtered page; filtering only the loaded browser page is insufficient.
- Permission revocation, document deletion and inactive estates retain the
  existing document lifecycle behavior.
- Unsupported API types fail safely without broadening the results or leaking
  foreign-estate metadata.

## Out of scope

- “Others” or any additional document category; new file formats or size limits.
- Removing size metadata from the API or changing asset/work-order table columns.
- Changing document permissions, associations, upload/storage or deletion policy.
- Dependency installation, deployment or unrelated database migration repairs.

## Open questions

None. The user has withdrawn the additional document type; this plan covers only
the remaining two requested changes.
