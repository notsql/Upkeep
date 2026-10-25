# 0033 — Work-order location consistency and estate context

Agreed 2026-10-23 during manual review of ID-36; refines decision 0032.

New work orders linked to an asset use exactly that asset's registered location.
The form confirms a location change before selection, then locks location until
the asset is removed. The API checks equality under the existing estate lock,
so queued creation cannot use an asset placement that moved during the wait.
Existing work-order history is preserved. Asset-free creation remains valid.

A source report's corrected location may differ from the chosen work location.
After a stale-source conflict, reloading requires an explicit choice between
the updated report location and retained work location. Edited descriptions
survive. Changing to an incompatible location requires removing the linked asset.

Estate context navigation uses the existing access projection for all membership
roles, not management-only estate reads. Choices show estate-local roles and
route to an allowed destination. This makes mixed Resident/Manager accounts
understandable without widening estate permissions or defining a global role.

Priority groups use newest-first ordering internally with a UUID final tie-breaker.
Cursor comparisons use the same ordering to preserve complete pagination.
