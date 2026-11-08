# 0044 - Asset history is a live read projection

**Status:** accepted

The agreed scope combines existing recorded activity and linked files for current
Owners/Council, without granting asset editing or private source-screen access.

Use a typed jOOQ union of occurrence/kind/UUID keys, one combined cursor/page limit,
and bounded hydration in a read-only repeatable-read transaction. Document paths
form one OR/EXISTS predicate before paging; original upload time remains the event
time. Keep the original tables as the only records. No migration, secondary event
store, invoice cost ingestion or prediction snapshots are introduced.

Expose `canViewAssetHistory` and a minimal directory separately from owner-only
asset reads. Recheck current authority, including Resident override, on every page.
Preserve authenticated document content checks and independent detail-link grants.
Responses are private/no-store. The frontend consumes generated discriminator
types, scopes caches/viewers to identity and asset, and restarts history after writes.

History reflects current records and associations. Completion corrections retain
canonical identity/time; unlinking/deletion removes document events on refresh.
Pagination is not a snapshot across requests. No extra index is proposed without
query-plan evidence. Native PDF/image previews retain authenticated download.
