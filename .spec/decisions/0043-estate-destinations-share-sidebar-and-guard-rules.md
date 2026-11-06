# 0043 — Estate destinations share one predicate for sidebar and route guard

**Status:** accepted 2026-11-04 (navigation re-architecture).

Each estate destination (Overview, Work orders, Fault reports, Inspections,
Assets, Devices, Readings, Device monitoring, Failure risk, Documents, Members,
Roles, Asset categories, Estate settings) has exactly one pure `canOpen*`
predicate in `apps/web/src/lib/estate-destinations.ts`. The sidebar
(`components/app-navigation.tsx`) and the `_auth` route guard
(`routes/_auth/route.tsx`) both import these predicates; neither restates a
rule. `estateDestination` (where choosing an estate lands) lives beside them.

Previously several sections were reachable only from overview buttons with
their own conditions, while the guard fell back to `canViewManagement`, so a
page could be hidden in the UI but open by URL, or the reverse.

`EstateAccessResponse` has no owner flag. Owner-based predicates therefore take
`owned` from `EstateResponse`: the sidebar reads the cached `useEstate` query,
and the guard calls `ensureQueryData` on the same key
(`["estates", userId, "details", estateId]`) only when the access flags alone
do not open the page. A failed fetch counts as not owned (fail closed, 404).
No server change. The API still enforces every rule; these predicates only
decide what the web app shows and routes to.

Consequence: adding or changing an estate section means editing one predicate,
and its truth table in `apps/web/tests/lib/estate-destinations.test.ts`.
