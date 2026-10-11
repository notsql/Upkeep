# Portfolio Home and estate directory

**Status:** implemented; current UI iteration accepted by the user (2026-10-09); Git merge and PR review pending
**Owner:** Chan Ding Jie
**Related story:** ID-93
**Branch:** `feat/ui-redesign`

## Problem

Signed-in Home and Estates both display accessible estate cards and invitation
information. Home needs a distinct reason to visit: understanding what requires
attention across estates. Estates should remain the place to find, create and
open an estate. The individual estate Overview remains the context for managing
that estate's details and locations, with links to assets and council controls.

This plan responds to the user's supplied dashboard suggestion. Its sample
figures are illustrative and must never become displayed application data.

## Decisions agreed (2026-10-08)

1. Include a small backend aggregation endpoint for accurate Home asset summaries.
2. Operational definition: active assets in active estates; attention
   means latest condition NEEDS_ATTENTION or FAULTY. UNASSESSED is separate.

The user agreed both choices and authorised implementing the reviewed page
layouts on 2026-10-08. Use the test-first workflow and review the result afterwards.

## Agreed behaviour

### Home: understand and prioritise

- Replace the full estate-card directory with a compact portfolio dashboard.
  Retain the compact header, themes and fixed mobile navigation already built.
- Show accessible estate count with an active/inactive breakdown. Asset summaries
  explicitly cover active estates the user owns, matching current asset access.
  A shared estate is not included in asset totals solely because its details are
  accessible. Show the scope beside the totals rather than implying full coverage.
- Show total active assets, Attention needed and unique accepted Council members.
  Not assessed remains in the condition breakdown rather than a duplicate card.
  Attention needed is the combined NEEDS_ATTENTION + FAULTY count; the condition
  breakdown's Needs attention label refers only to NEEDS_ATTENTION.
  Condition breakdown uses the actual GOOD / NEEDS_ATTENTION / FAULTY / UNASSESSED
  categories, labelled Good / Needs attention / Faulty / Not assessed. Each asset
  contributes once using the register's latest-assessment selection rules.
- Use count cards and a readable labelled condition breakdown; no invented score
  or large chart library. A zero is shown only after a successful summary response.
- Show a short ranked list of estates needing attention with their actual name,
  code, active-asset count, Needs attention count and Faulty count. Prioritise the
  largest combined attention count, then Faulty count, with a deterministic tie
  order. Default to five rows; healthy estates do not fill this action list.
- Row actions open the existing estate asset register with ACTIVE and the selected
  single condition filter. Faulty and Needs attention have separate links because
  the existing register accepts one condition at a time. Global condition counts
  remain explanatory except Attention needed linking to the estate attention
  section; no cross-estate asset-list route is implied.
- Pending invitations become a small count/message and Review invitations link to
  Estates, where users accept them. Avoid repeating the full invitation list.
  Existing email reconciliation stays on Estates; Home does not accept invitations.
- The Accessible estates card links to the directory; no separate Browse estates
  button is shown. Create estate stays primarily on Estates.
  Users with no asset-readable estates still see genuine estate/invitation data
  and an explanation of asset-summary availability, rather than misleading zeros.
- Summary and invitation loading/errors remain independent, with appropriate
  retries. Empty data, unassessed assets and unavailable data are distinct states.

### Estates: find, create and open

- Keep the estate directory, Create estate action and invitation acceptance flows.
- Add case-insensitive search by name, code and address using the existing list
  response. Retain status filtering; add All access / Owner / Shared with you.
  The API exposes ownership and capabilities, not a universal Council Member role
  label, so do not label every shared account as a Council Member.
- Use compact responsive controls: search full width on mobile, status/access
  controls together below it. Preserve filter/search values on back navigation.
- Cards show name, code, address, status and Owner/Shared with you. Make each card
  a single real navigation link with visible keyboard focus; avoid nested links
  or buttons within the clickable card.
- Distinguish no estates from no filtered matches and offer a permitted next
  action or Clear filters. Detailed condition analytics belong on Home/assets.

### Individual estate Overview: manage this estate

- Preserve the currently built compact summary, management action group, location
  hierarchy and Assets/Council entry points. Opening a Home attention item leads
  to the appropriate filtered asset register in this estate.
- Do not expand this pass into monitoring, recent-activity feeds or estate health
  scores. A richer estate operational dashboard can be planned separately.

## Data

No new Prisma models or migrations are proposed. Use existing Estate access,
Asset and AssetAssessment records. Retired assets and inactive estates are
excluded from operational condition totals under the recommended definition.
Do not count assessment rows as assets or treat missing assessments as Good.

## API — agreed contract

`GET /dashboard/summary`, authenticated and scoped to the current user.
Return a real DTO with:

- accessibleEstateCount, activeEstateCount, inactiveEstateCount;
- activeOwnedEstateCount, totalActiveAssets, councilMemberCount;
- conditionCounts: good, needsAttention, faulty, unassessed;
- affectedEstateCount and up to five estatesNeedingAttention rows: estateId,
  estateName, estateCode, totalActiveAssets, needsAttentionCount, faultyCount.

All counts are nonnegative integers. Condition counts sum to totalActiveAssets;
aggregate counts use a consistent database snapshot. Authentication failures use 401; unavailable
service uses the established error contract. The server aggregates in bulk;
do not fetch every estate's full assets into the browser or query once per asset.
Owner-only asset permissions remain intact; no global admin bypass is added.
Regenerate OpenAPI/frontend types with the controller and use a user-scoped,
session-gated React Query hook. Estate directory filtering reuses GET /estates;
invitation counts reuse the existing recipient query.

## Test-driven implementation

- Backend first: failing tests for user isolation, ownership scope, active versus
  inactive/retired data, latest assessments, unassessed assets, count consistency,
  ranking/ties/limit and empty results. Then aggregation and generated contract.
- Home: failing tests for real summaries, accurate scope labels, filtered estate
  destinations, compact invitations, no duplicate directory, loading/empty/error
  distinctions and independent retries. Preserve signed-out Home behaviour.
- Estates: failing tests for name/code/address search, ownership/status filters,
  back-navigation state, full-card keyboard links and retained invitation flows.
- Run normal repository checks and browser review for both themes/mobile/desktop.
  Update the matching as-built docs with the implementation.

## Out of scope

- Broader shared-member asset read access or role-policy changes.
- Device online/offline inference, telemetry ingestion, trends or predictive health.
- Recent-activity feeds and a new cross-estate asset browser.
- New dependencies, pagination, invented analytics, API writes or database changes.

## Implementation and review evidence (2026-10-08)

Observed failing backend tests for the missing summary, frontend tests for the
missing dashboard/directory controls, navigation regression against the prior
route without URL filters, and mutation-refresh regressions before invalidation
changes. A focused HTTP test exposed an unhandled jOOQ database error; the
controller advice now safely handles both jOOQ and Spring data-access failures.

Implemented one bulk summary endpoint, generated DTO contract and user-scoped
query, portfolio Home and the filtered full-card directory. Existing API paths
and DTOs are semantically unchanged; no migration or dependency was added.
The normal API export was attempted but its Maven exporter plugin was not cached.
Instead, the installed Spring Boot runtime exported the real `/v3/api-docs` on
a temporary port with the normal localhost:8080 document URL; the existing Nx
OpenAPI type generator generated the frontend types. The temporary process was stopped.

Checks pass: pnpm fix, pnpm check-types, pnpm test (210 backend tests),
final web tests (173 tests), and web production build. Documentation links
resolve and git diff --check passes. Test fixtures model assessment changes
without changing asset totals, and estate renaming without changing estate counts.

Manual acceptance remains: compare Home and Estates on desktop and phone in
light/dark themes, check attention links, keyboard focus and directory back
navigation. ID-93 remains pending visual acceptance. Changes remain uncommitted;
the previously resolved main merge still awaits index finalisation.

## Visual refinement (2026-10-09)

**Status:** implemented; visual acceptance pending (2026-10-09).
The user rejected repeating Not assessed above its condition breakdown, so replace
it with Council members using the definition below. The user selected the
attention-section jump.
The supplied screenshots are layout references; their example numbers are not
application data. This agreed revision replaces the relevant presentation choices above.

### Presentation

- Use the existing shadcn Cards with a balanced two-by-two statistics grid on
  tablet/desktop and a single column on narrow phones. Each card has a small
  decorative lucide icon, a clear label, a large actual count and a short scope
  description. Preserve the application's light/dark tokens and navy/teal design.
- First three statistics remain Accessible estates, Active assets and Attention
  needed. The fourth becomes Council members; Not assessed remains in the condition breakdown.
- Make scope visible within the cards: Accessible estates includes owned/shared
  estates; asset statistics cover active estates the caller owns. State the
  number of active owned estates alongside the asset summaries. Shared-only
  accounts retain em dashes and the availability explanation, not invented zeros.
- Replace the badge-only condition presentation with a segmented distribution
  bar inside the existing shadcn surface: Good green, Needs attention amber,
  Faulty red, Not assessed neutral. Segment proportions come from actual counts
  divided by totalActiveAssets. Use a route-local CSS figure, not a progress
  indicator (this is a distribution, not task completion), and no new chart
  dependency. Keep a readable legend with labels and exact counts; do not rely
  on colour to convey condition.
- With zero active assets, show a neutral empty track and No active assets
  guidance, without division by zero or implying healthy/unassessed assets.
  Loading/error states continue to avoid fabricated counts.
- Remove the standalone Browse estates button (user decision, 2026-10-09).
  Accessible estates links to the directory; sidebar/mobile Estates navigation remains. The recommended Attention
  needed action is a real in-page link to Estates needing attention, with clear
  focus at the destination. Do not present a portfolio statistic as a link to
  an arbitrarily chosen estate. Keep unavailable statistics noninteractive.
- Make each attention-row estate name/code a routed link to that estate's active
  asset register. Retain its separate Review faulty / Review needs attention
  buttons and avoid nested interactive elements.

### Agreed decisions

1. **Fourth statistic:** Council members. The definition is
   distinct accepted member user IDs across active estates the caller owns,
   excluding the caller and pending invitations. The same person in multiple
   estates counts once. This needs a summary DTO/query update and contract
   regeneration; counting must not call WorkOS once per member. Do not conflate unique people with membership grants.
2. **Attention-card destination:** the existing attention section. A combined
   cross-estate asset list remains out of scope. The current register is per
   estate and accepts one condition at a time; retain its two separate condition links.

### Verification

Use failing tests first for new destinations, clear scope text, actual
distribution counts, empty/shared-only/error states and any chosen backend
extension. Test distributions through accessible labels/counts rather than
CSS snapshots. Review the two-by-two layout, phone wrapping, light/dark colour
contrast and keyboard focus manually. Update the existing dashboard as-built
docs with the final implemented decisions and run the appropriate repository
checks. No changes to permissions or Neon schema are proposed.

### Refinement verification evidence (2026-10-09)

New backend tests failed on the missing councilMemberCount before implementation;
new web assertions failed on the fourth card, distribution and empty states.
The removal of Browse estates was also seen failing before removing the action.
The existing signed-in Home navigation test now supplies a real summary fixture
and waits for its Accessible estates link, since the removed header action was
previously available before the summary loaded.

The council count uses a distinct member aggregate in the existing SQL statement,
with no asset-join multiplication or WorkOS calls. Tests cover duplicate member
IDs, owner exclusion, pending invitations, shared/inactive estates, member removal
and empty scope. Generated API DTOs include the new required int64 field.

pnpm fix, pnpm check-types, web build and the full test suite pass. The cached
workspace test run restored an old compiled dashboard DTO; javap confirmed its
missing accessor. Cleared only apps/server/target with offline Maven clean and
reran pnpm test --skip-nx-cache successfully (211 backend tests). No test assertions
were weakened to conceal that cache problem. API export used the same installed
runtime fallback because the normal Maven exporter remains uncached.

No Neon schema changes, dependencies, broader asset access or cross-estate asset
list were added. Docs match the refined UI; manual visual acceptance remains.
Changes remain uncommitted on feat/ui-redesign.
