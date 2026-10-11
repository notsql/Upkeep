# Portfolio Home (frontend)

Signed-in `/` mounts `routes/-components/workspace-home.tsx` through
`HomePage` in `routes/-components/home-page.tsx`. The public route remains
`routes/index.tsx`; signed-out Home retains Sign in/Create account and System
status. Private dashboard requests wait for the browser/session gate.

## Screen

`WorkspaceHome` uses PageHeader, shadcn Card/Button/Alert with existing lucide icons.
Four count cards use two columns on tablet/desktop and one on narrow phones:
Accessible estates (owned/shared with active/inactive breakdown), Active assets,
Attention needed and Council members. Not assessed appears only in the condition
breakdown. Decorative icons accompany the titles; counts and descriptions remain
accessible. Council members counts unique accepted members, excluding the caller
and pending invitations, across active owned estates. Counts come from
the summary response; loading and failed requests never substitute zeros.
Asset summaries explicitly cover active estates the user owns. When
`activeOwnedEstateCount` is zero, asset and member cards display an em dash with a scope
explanation and the condition/attention sections are omitted.

`routes/-components/asset-condition-distribution.tsx` draws a proportional CSS
figure inside the shadcn surface. Its green/amber/red/neutral segments represent
Good / Needs attention / Faulty / Not assessed. A visible legend and accessible
caption retain exact counts and percentages; colour is not the sole label.
Needs attention uses amber-600 (amber-400 in dark mode); Faulty uses red-600
(red-400 in dark mode), shared by bar segments and legend dots so they are
clearly distinct rather than reusing the badges' darker text colours.
Thin card-coloured gaps separate segments; legend labels use medium weight for
clearer light-mode reading.
Zero active assets get an empty neutral track and No active assets to assess,
without division by zero or a misleading distribution. Each count represents
one active asset's latest condition;
unknown condition is never presented as Good. The separate Attention needed
card combines Needs attention and Faulty. No chart library or invented score
is used.

The attention section displays up to five ranked estates with actual name/code,
active-asset total and separate Needs attention/Faulty totals. Nonzero counts
have routed buttons to `/estates/$estateId/assets` with `status=ACTIVE` and
`condition=FAULTY` or `NEEDS_ATTENTION`. These reuse the existing single-condition
asset filter. The Attention needed card is a real anchor to the attention heading, which
receives focus without suppressing native anchor scrolling. Each estate name
links to its active asset register. These are not cross-estate browser links.
The screen reports when the five rows represent a larger affected count.
No assessed active assets needing attention and unassessed assets remain distinct.

The Accessible estates card links to `/estates`, the directory and primary
Create estate location. The redundant Browse estates button is removed; sidebar
and mobile navigation retain Estates. Home does not duplicate its full estate
cards or invitation names.
Pending invitations are a compact count with Review invitations linking to
Estates. Home does not reconcile or accept invitations. Summary and invitation
requests have independent loading/error/retry states. Empty portfolios explain
how to get started through Estates.

## Data and refresh

`lib/dashboard.ts` imports the generated DashboardSummaryResponse type.
`useDashboardSummary()` calls `GET /dashboard/summary`, query key
`["estates", userId, "dashboard"]`, enabled only when useEstateSession is ready,
with `retry: false`. Errors use estateError. User keys prevent sharing cached
portfolio data across accounts; SSR does not fetch private data.

`usePendingCouncilInvitations()` calls `GET /council-invitations`, key
`[userId, "council-invitations"]`. Acceptance/reconciliation remains in
[the estate directory](estates.md) and [council management](council-invitations.md).

Creating/editing/deactivating an estate, creating/retiring/restoring an asset and
recording an assessment invalidate the dashboard key as well as their existing
feature queries. Council acceptance and member removal already invalidate the caller's entire
`["estates", userId]` prefix. Changes from other sessions follow existing React
Query staleness/focus refresh; no polling or real-time subscription was added.

See [the API contract](../api/dashboard.md) for scope, ranking and count rules,
and [the shared design guide](design-system.md) for themes and navigation.
