# 0042 — Stream complete filtered readings with explicit completion metadata

**Status:** accepted for ID-61 / ID-64, 2026-10-28.

Use one authenticated estate-scoped CSV endpoint with the same Owner/Manager/Crew
policy and the same typed source/flag/filter query as the reading browser. Ignore
browser pagination. Do not reconstruct an export by iterating offset pages.

A single database cursor supplies the export snapshot and a window count of all
matching rows. Spring opens the read-only transaction on the streaming worker,
fetches at most 512 rows per batch, and emits CSV v1 in UTF-8. Per-record SQL
result logging is disabled for this query only, to avoid copying whole exports
into DEBUG logs. Existing list queries and their logging are unchanged.

Reserve one of two export slots before returning the streaming response. Release
it on completion, failure or timeout; the executor has two threads and no queue.
The transaction timeout is 230 seconds, MVC's async timeout 240 seconds, and the
Cloud Run deployment explicitly declares 300 seconds. Streaming is not an
unlimited-duration or background-job guarantee.

The response includes X-Export-Row-Count from the same SQL snapshot and an
attachment filename. Expose these headers through CORS. The generated client's
stream reader incrementally checks the schema header, quoting/column structure
and expected row count before constructing a downloadable Blob. Cancellation,
transport failure or a context change must never save a partial/stale file.

Record numeric values and UTC times in a fixed, documented format. Preserve
SENSOR/MANUAL source, device identity and manual recorder attribution, including
honest empty nullable metadata. Spreadsheet-active text is reversibly escaped;
actual numeric values remain numeric. This is a raw export, not anonymization,
interpolation or training data transformation.

No job table, queue or persisted storage artifact is introduced. A real HTTP
benchmark with more than 32 MiB and at least 100,000 matching mixed-source rows
must complete within the agreed budget. If deployment limits are exceeded,
revisit durable jobs explicitly rather than silently truncating output.


Excel compatibility correction agreed 2026-10-28: prefix each export, including
empty exports, with one UTF-8 BOM. Excel otherwise guessed a legacy encoding
and displayed `°C` as `Â°C`. Pipeline consumers use BOM-aware UTF-8 (`utf-8-sig`
in Python); data columns, numeric values and completion counts are unchanged.
The browser validates decoded text but saves the original bytes, including the
marker. A regression checks the marker across single-byte stream chunks.
