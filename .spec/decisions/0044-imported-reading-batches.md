# 0044 — Audited historical imports with separate storage

Accepted by the user on 2026-11-06 through the request to implement the import tests.

ImportedReading is separate from sensor/manual measurements and carries a batch
foreign key. An estate/asset/metric/UTC-microsecond key makes vendor history
idempotent. Equal decimals are duplicates; conflicts never overwrite history.
Range outliers remain useful evidence and import with warnings.

The bounded synchronous import validates a whole file before accepting any rows.
An estate write lock serializes submission retries, lifecycle changes and rollback.
Accepted readings and row reports commit together. A rollback deletes only the
batch's inserts, while batch metadata and original normalized reports remain.
Uploaded CSV bytes are temporary and are not stored as an audit artifact.

Reading queries union all three sources before flags/filtering/paging. Imported
history does not change sensor predecessors, live availability, flatline evidence,
condition assessments or failure-risk inputs. The export header remains v1 with
an additive IMPORT source. Exact decimal text remains the transport for display.

Limits are 25 MiB, 100,000 nonblank records, 128 columns, 4,096 characters per
field, 200-character source labels, and report pages capped at 200. Two admission
slots bound concurrent processing; no queue or durable worker is introduced.
Review workload and deployment evidence before expanding these limits.

The batch detail screen uses route-local metadata, row-results and rollback
components with explicit props (refactor agreed on 2026-11-07). One page-state
hook retains the coordinated request cancellation and user/estate/batch resets;
query/mutation hooks and generated API types remain in `lib/reading-imports.ts`.
