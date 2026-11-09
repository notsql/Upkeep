# Historical reading import screens

Entry: an outline **Import CSV** link with Upload icon in the estate Readings
header; filters and export live in the readings toolbar. Owner/Manager import capability controls it;
manual-entry permission alone does not grant import. Inactive-estate reading
browsers explain that import and rollback are unavailable.

## Routes and screens

| Route folder under `apps/web/src/routes/_auth/estates/$estateId/readings/` | Screen |
| --- | --- |
| `imports/index.tsx` | ReadingImportsPage: upload, column mapping, bounded sample and paginated batch history |
| `imports/$batchId/index.tsx` | ReadingImportBatchPage: metadata/counts, paginated outcome-filtered report, download and rollback |

Both routes use the shared auth guard. Crew bookmarks are rejected before child
loaders; Manager read access remains available on inactive estates. Actions
follow server-projected canImportReadings/canRevertReadingImports and the API
rechecks current policy. Page-local components live in each route's
`-components/`; no dot-named routes or handwritten API types are used.

Upload components are `reading-imports-page.tsx`, `import-form-fields.tsx` and
`import-history.tsx`. Batch components live in `$batchId/-components/`:

- `reading-import-batch-page.tsx` composes the header, access/loading/error
  states, metadata, row results and rollback dialog.
- `use-reading-import-batch-state.ts` coordinates permissions, detail/row
  queries, outcome filtering and pagination, report download and rollback,
  including cancellation and resets when the user, estate or batch changes.
- `import-batch-metadata.tsx` displays source/uploader/counts and rollback
  metadata, with download and permitted revert actions.
- `import-batch-results.tsx` renders the outcome filter, query states and
  pagination around `import-row-results.tsx`, the responsive table/card renderer.
- `import-batch-rollback.tsx` renders the confirmation dialog, inserted count,
  required reason and pending/error feedback.

The sections receive explicit data and callbacks rather than the entire page
state. Batch/row types come from the generated contract via
`lib/reading-imports.ts`. They use PageLayout, FormPageHeader/DetailPageHeader,
SectionCard, FormActions, shared LoadingState/ErrorState/EmptyState, Pagination,
ConfirmDialog, and shadcn Card/Table/Field/Input/Select/Alert/Badge/Button.
Named, focusable overflow sections contain desktop tables; useMobile selects
cards below 768px from the same query state. Resizing does not reset paging,
filters or mapping. Source labels, filenames and issues wrap.

The file picker is labelled CSV file; Source label is required. A FileReader
reads at most 64 KiB locally and previews at most six records including the
header. `lib/reading-import-preview.ts` parses quotes/newlines without numeric
conversion. This is a preview; Spring validates the whole upload. It retains
final records with an empty last column even without a trailing newline.
Exact export headers choose EXPORT; other files use VENDOR. Asset lookup selects
UUID or reference; mapping controls choose distinct headers for asset, metric, measured
time and value, plus optional unit. Submit sends the original File and a JSON
options Blob in FormData through the generated client.

A synchronous ref guard prevents double submission. The pending form/footer
are disabled. Recoverable errors retain file/mapping/source. The submission UUID
is retained for the same file object/source/normalized mapping and replaced when
input changes. A lost response can be reconciled through batch history; cancelling
a browser request does not undo a committed batch. Estate/account changes abort
in-flight requests, reset upload state and prevent late navigation/results.

The report preserves every record/physical-line number, outcome, issue code,
field and reason on desktop and mobile. All-invalid batches use the normal
completed report. Outcome filtering resets page zero. Report download uses the
typed client and bearer-token bridge, then a temporary Blob URL; it never sends
a raw fetch or a manually attached Authorization header.

Rollback uses ConfirmDialog with source label, actual inserted-row count and a
required reason. Pending state disables the dialog. Errors retain the reason and
open dialog. Success refreshes affected data and shows Sonner feedback. Reverted
batch metadata and original row outcomes remain visible.

## Queries and mutations

Hooks in `lib/reading-imports.ts` derive all request/response types from
`@proj/api/schema`. They throw returned API errors and disable automatic retries.
Per-user keys begin `[userId, "reading-imports", estateId, ...]`:

| Hook | Key suffix | Endpoint |
| --- | --- | --- |
| useReadingImports | `"list", page` | GET `/estates/{estateId}/readings/imports`, size 50 |
| useReadingImport | `batchId` | GET `/estates/{estateId}/readings/imports/{batchId}` |
| useReadingImportRows | `batchId, "rows", page, outcome` | GET `.../{batchId}/rows`, size 50 |
| useImportReadings | mutation | POST `/estates/{estateId}/readings/imports`, file/options multipart |
| useRevertReadingImport | mutation | POST `.../{batchId}/revert`, `{ reason }` |
| downloadImportReport | scoped abortable transfer | GET `.../{batchId}/report`, parseAs blob |

Successful import/rollback invalidates batch list/detail/rows,
`[userId,"estate-readings",estateId]`, `[userId,"reading-assets",estateId]` and
the existing `["estates",userId,"assets",estateId]` family containing legacy
asset readings. Existing reading filters stay unchanged; backdated imports may
appear on later pages. User/estate changes get distinct caches and abort stale
transfers. Source display uses Import, source label and batch reference on both
estate/legacy tables and mobile cards, without inventing a device or recorder.

See [the API contract](../api/reading-imports.md) for limits, row validation,
deduplication, provenance retention and rollback ownership.

## Colours

Each row's outcome `Badge` takes `badgeVariantFor(readingImportOutcomeTone[outcome])`
(`lib/status-tone.ts`): `IMPORTED` success, `DUPLICATE` muted (secondary), `INVALID` danger
(destructive). The imports page header is `FormPageHeader` with an `Upload` icon tile, the batch
page `DetailPageHeader` with `FileSpreadsheet`; their empty states carry the same icons. See
[design-system.md](design-system.md).
