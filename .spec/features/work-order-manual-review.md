# Work-order manual review refinements

**Status:** implemented; landscape estate-menu fix verified 2026-10-24; formatting passes; ready for human commit/PR review

## Problem

Manual review found unclear linked navigation, missing estate-overview work-order
access, random-looking priority ties, intrusive report filters, unclear location
conflict handling, and estate navigation that hides role context.

## Already changed

Before the user requested a collect-first workflow, report list/detail gained
PageHeader breadcrumbs and scoped filter styling. Three breadcrumb regressions
were observed failing before implementation; all 56 focused report/filter/form
tests then passed. These changes and documentation remain uncommitted. Full
verification and visual review are still required.

## Agreed behaviour

1. Make the saved work-order asset link visibly interactive with a persistent
   underline, theme-compatible colour and keyboard focus. Apply the same treatment
   to View source report. Readers without the independent capability see plain text.
2. Add View work orders to estate overview actions, gated by canViewWorkOrders.
   Retain access to inactive history without expanding overview permissions.
3. Sort priority groups in the requested direction, then newest creation first,
   then UUID descending for equal timestamps. Reversing priority changes group
   order only. Update keyset comparisons together, retaining cursor encoding,
   filters and estate authorization. Other sort modes remain unchanged.
4. Replace inline resident-report selection/filter controls in the creation form
   with a selector button opening a shadcn Dialog. Show selected report title on
   the form. Put existing block/range filters, results and pagination in the dialog.
   Preserve selection while filtering and retain the report-detail conversion URL.
5. Use structured, design-consistent shadcn conflict feedback. Show refreshed
   source location and current work location. After a source-placement conflict,
   reload the report and require an explicit Use updated report location or Keep
   work location choice before submitting again. Preserve edited description.
   Show interrupted-connection advice only for ambiguous network failures.
6. Keep report destinations restricted to active LEVEL or COMMON_AREA nodes.
   No level means a common area directly under the block is required; a bare
   BLOCK stays invalid. Explain disabled Save and use an appropriate common-area
   placeholder when no level is selected.
7. Agreed asset policy: a newly linked asset
   and work order must have exactly the same location ID. Selecting an asset
   sets the work location to its registered location; confirm first if this would
   change an already chosen location. Show the location in the picker and lock
   work location while linked; removing the asset unlocks it. Enforce equality
   on the server as well, including under the existing creation lock. If source
   reload offers a different report location, require removal of an incompatible
   asset before switching; never silently unlink it. Existing saved orders remain
   readable. Asset-free work orders remain allowed for every category.
8. Signed-in callers lacking the requested work-order capability see Page not
   found for direct list/detail/create URLs, including resident-only and
   unassigned accounts. Evaluate the work-order guard before general workspace
   and resident redirects. Signed-out callers still go to sign-in; normal
   resident entry remains available.
9. Provide estate context switching even with one accessible estate, including
   resident-facing navigation. Show the current estate and estate-local role;
   label every choice with its role and include all accessible membership estates.
   Use access context, not a global role or management-only estate reads.
   Preserve current report/work-order feature when the chosen estate permits it.
   Otherwise open management overview when allowed, work orders for Crew, or
   resident reporting with the chosen estate preselected for Resident membership.
   Inactive resident estates cannot accept submissions; explain that state rather
   than selecting another estate. Keep feature-specific navigation capability
   gated. Use the existing MANAGER role label; do not infer Owner from that label.

## Agreed location decisions

The existing agreed specification permits a different work location from both the
source report and linked asset. Item 5 requires explicit acknowledgement for report
differences. Item 7 changes the asset rule to strict location equality.
Both refinements, including strict asset/location matching, were approved by the
user on 2026-10-23 together with the full implementation batch.

## Data and API

No new tables or endpoints are planned. Asset validation changes on the existing
creation endpoint returns 400 for an invalid location combination. Review existing race/conflict handling for moved
assets. The existing asset-picker DTO already includes location ID and path.
Priority list ordering changes internally with cursor comparisons.

If controller documentation changes, regenerate OpenAPI and generated TypeScript
through the repository contract workflow. Never hand-edit generated types.
Update matching API/frontend docs and the original create/sorting specs to agree
with the approved location and ordering refinements.

## Implementation and verification

- Agree this batch and its location decisions before further application edits.
- Start each behaviour change with a failing observable test and run it.
- Cover priority ordering both ways with opposing UUID/time values, timestamp
  ties and multiple pages; assert no skipped/duplicated orders and preserved filters.
- Cover report dialog selection/pagination, conflict reload/choice/preserved edits,
  no-level explanation, optional assets and location matching including server
  validation and concurrent lifecycle changes.
- Cover unauthorized direct URLs without protected queries, single-estate and
  mixed-role switchers, resident preselection, inactive estates and destinations.
- Keep earlier tests unchanged unless the agreed behaviour changes their contract.
  Explicitly identify any intentionally superseded location tests.
- Use existing shadcn components and folder routes, install nothing.
- Run focused tests, then workspace type checks, full web/backend tests, formatting
  and production web build through Nx. Inspect final diff for unrelated formatting.
- Manually verify navigation, mobile, themes, keyboard focus and error presentation.
- Leave changes uncommitted; never push.

## Confirmed manual results

Basic creation, optional asset selection, required source explanation validation,
report conversion, basic filters/sorting, non-owner Manager creation, owner-only
asset denial and Crew creation denial pass. On 2026-10-24 the user reported the
updated source-conflict/reload flow and keyboard access working. Their screenshot
shows refreshed report location L2 versus current work location L1, both explicit
choices, and Create disabled until a choice is made. These are user-reported
manual passes; the agent did not independently submit both conflict choices.

## Browser review (2026-10-24)

Windows Chrome viewport checks covered 320px/390px portrait and 844 x 390
landscape, light/dark themes, mobile navigation, asset/report pickers, asset
location locking, sorting, breadcrumbs and linked navigation. Portrait screens
tested fit without page-level horizontal overflow. Detailed evidence and
screenshots are listed in `/tmp/cs203-mobile-review.md`.

A second pass used one account with Crew in Testing, Resident in TEST2,
non-owner Manager in Test 3, and other memberships. Estate-scoped checks passed:

- Crew list/detail and source-report links open; Create is hidden; direct
  creation and asset-register URLs show Page not found. Estate breadcrumb and
  linked asset remain plain text where independent access is absent.
- Switching to Resident preselects TEST2 in reporting and displays Resident.
  Direct work-order list/create/detail URLs show Page not found despite Manager
  access elsewhere. Personal report history/detail remain readable.
- Non-owner Manager can open creation, select an asset from the limited picker
  and lock location, and open/prefill from a source report. The asset register
  remains denied. No creation or relocation was submitted in this role pass.
- All five membership choices and their estate-local roles appear in the
  dropdown. Portrait reporting controls, dark theme and the submit action fit;
  the action remains above the bottom navigation after scrolling.

**Landscape defect, now fixed:** at 844 x 390, scroll the desktop sidebar to the
estate switcher and open it. The five-choice popup opens at y=-28, height=276,
clipping the first estate above the viewport. Reproduced with browser mouse
input after layout settled. Evidence: `/tmp/cs203-qa-role-landscape-mouse.png`.
The user approved fixing this finding after the review. A live Chrome regression
using Node's built-in test runner was written first and failed with
`Menu top -28 is above the viewport`; the portrait control passed. The switcher
now caps menu height at the smaller of 20rem and shadcn's available-height value,
preserving the primitive's internal scrolling. No shared UI primitive was changed.

The unchanged browser assertions then passed at 844 x 390 and 320 x 740: landscape
menu y=5, height=242.5, and first/last estates reachable by scrolling; portrait
menu y=143, height=276. Fixed screenshot:
`/tmp/cs203-qa-role-landscape-fixed.png`. The local QA harness and output are
`/tmp/cs203-estate-menu.test.mjs`, `/tmp/cs203-estate-menu-red.log` and
`/tmp/cs203-estate-menu-green.log`; they use the existing signed-in Windows Chrome
QA profile/driver, without adding a repository browser-testing dependency.
After the fix, all 555 web tests, workspace type checks, full pnpm fix and the
production web build passed. Server code was unchanged by this layout fix;
the previous 877 backend test pass remains applicable.

## Remaining manual checks

Failed-save feedback; sole-estate and Crew-only/Resident-only account shells.
Physical phones/native keyboards and iOS Safari remain unverified; the user has
no physical phone available for this localhost session. The mixed account pass
verifies estate-scoped permissions, not the separate sole-role shell branches.

The attempted offline check in the first browser pass eventually created
TT-123-W0015 after connectivity returned; it did not verify failed-save feedback.
The QA record was left intact and disclosed to the user. The subsequent role
pass submitted no records and performed no report/estate mutations.

## Out of scope

Report-submission role expansion, saved inspection integration, assignment,
status transitions, costs and unrelated screen changes.

## Implementation verification

Tests were added and observed failing before implementation for unauthorized
redirects, overview access, priority tie pagination, strict asset location,
report picker dialog, no-level feedback, source reload acknowledgement, asset
confirmation/locking, role-aware navigation, resident preselection and error
classification. Existing immediate-submit reload assertions were explicitly
superseded by the agreed location-choice rule. The old priority tie fixture now
pins timestamps equally to retain coverage of the UUID fallback. Management-list
switcher tests were explicitly updated for access-context choices and role labels;
a shell mock was corrected to supply the router's search object without changing
its behaviour assertions.

Final results: 555 web tests, 877 backend tests (including queued asset relocation),
workspace type checks, production web build and web formatting/lint pass.
Full pnpm fix initially encountered missing Java formatter dependencies in the
PC's offline Maven cache. Rechecked on 2026-10-24 at 02:05 +08 with
`MAVEN_ARGS=-o pnpm nx run server:lint --output-style=static`: Spotless check
passed for 255 Java files. The needed dependencies are now cached; no packages
were downloaded or application source changed by this recheck. Java formatting
is no longer a blocker. New test files mirror the corresponding source folders.
No controller/DTO or schema changes were needed, so no contract regeneration or
migration was required.

The browser review and its remaining checks are recorded above. All changes are
uncommitted on feat/create-work-order at base 8f0d8b2; nothing was pushed.
