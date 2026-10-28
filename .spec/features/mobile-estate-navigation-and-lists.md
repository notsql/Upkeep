# Mobile estate navigation and lists

**Status:** built and verified 2026-10-28
**Owner:** Chan Ding Jie

## Problem

The mobile estate navigation wraps eight section links into several rows above
the page content. Desktop and mobile put recently added destinations before
Overview. Wide readings, documents and work-order tables require sideways
scrolling to connect an entry with its details or actions.

## Behaviour

### Estate navigation

- Use one permission-filtered destination order on desktop and mobile:
  Overview, Assets, Work orders, Fault reports, Readings, Documents,
  Estate members, Roles.
- Keep existing access requirements for every destination. Overview is first
  when authorized; an account without overview permission starts with its first
  authorized section. This presentation change grants no new access.
- Desktop keeps the sidebar and its estate switcher.
- Below the existing 768px sidebar breakpoint, replace the wrapping local
  navigation with a full-width shadcn DropdownMenu labelled "Estate section".
  Its trigger names the selected section and includes its icon and a chevron.
- The estate switcher remains a separate control above the section selector,
  showing estate name and role. Both controls fit narrow screens and long names.
- Menu destinations remain real links with the selected link marked
  `aria-current="page"`. Nested pages retain their parent section selection.
- Choosing a section preserves the estate and uses the existing section route.
  Existing estate-switching permission fallbacks remain unchanged.
- The menu scrolls within the available viewport. All choices are reachable
  using touch and keyboard, with visible focus and distinct selection.

### Responsive lists — first pass

- Keep the existing desktop tables, sorting, filters and page sizes.
- On mobile, render the same fetched readings, documents and work orders as
  compact, labelled records using existing shadcn Card and Button components.
  Apply the readings presentation to both estate-wide and asset reading lists.
- Each reading shows metric/value/unit, asset where relevant, measured time,
  Manual/Sensor source, recorder attribution where available, device identifier
  where applicable and all suspect flags. Long identifiers and flags wrap.
- Each document shows filename, type, upload time and size, plus existing
  permitted download, association and deletion actions. Long filenames wrap.
- Each work order shows linked reference, description, priority, status,
  category and creation time. Existing mobile sort controls remain usable.
- All currently visible information remains reachable without sideways page
  scrolling. Do not expose fields the existing API does not supply.
- Preserve active filters, sorting, page selection, query keys, permission
  checks, loading/error/empty states and pending action protection.
- A single set of fetched rows drives either responsive presentation; do not
  fetch a second list for mobile or duplicate focusable controls in the visible
  accessibility tree.
- Pagination controls fit narrow screens and retain numbered pages and
  ellipses where those already exist. This change introduces no new paging API.

## Data

No schema, migration or persisted data changes. Existing demo records suffice
for readings and work-order layout checks. Document checks must use permitted
existing documents or explicitly labelled QA uploads.

## API

No new endpoints, DTO fields, authorization rules or query parameters.
Existing feature hooks and generated contract remain authoritative.

## Edge cases

- Long estate names, filenames, UUID-like identifiers and verbose flags.
- Zero or one authorized estate sections; absent overview permission.
- Nested creation/detail screens, browser back/forward and direct URLs.
- Loading access context, account changes and failed access requests must not
  display another account's previously authorized destinations.
- Read-only roles must retain their read access without gaining write controls.
- 320px, 375px and 768px widths; short landscape viewports; keyboard focus;
  dark mode; menus closing after navigation; browser resizing.
- Backdated readings, retired assets and mixed Manual/Sensor rows must retain
  their existing provenance and flags in either presentation.

## Implementation phases

- [x] Agree destination order, section selector and mobile record layout.
- [x] Write and observe failing navigation tests for order, capability filtering,
      nested selection and section navigation; implement with existing shadcn.
- [x] Write and observe failing behaviour tests for mobile record content,
      links, document actions and permission boundaries; implement the lists.
- [x] Run relevant tests, workspace type checks, formatting and web build.
- [x] Verify the real browser at narrow and desktop widths with long names,
      populated/empty lists, menus, sorting, filters and pagination. Browser
      geometry checks establish overflow behaviour; jsdom tests do not.
- [x] Update `.docs/frontend/shell.md`, `design-system.md`, `readings.md`,
      `documents.md`, `work-orders.md` and the documentation index as applicable.

## Out of scope

- A complete application redesign, new global navigation or role policies.
- CSV export, new metrics, backend pagination changes or data generation.
- Converting every other table in the application in this pass. Assets and
  estate members can adopt the same pattern in a separate agreed follow-up.

## Verification record — 2026-10-28

- Before implementation, the web suite had eight expected new failures and
  831 existing passes (`/tmp/cs203-mobile-red.log`). The corrected asynchronous
  navigation checks subsequently failed on the actual missing section trigger
  and incorrect section order (`/tmp/cs203-mobile-partial.log`).
- Final web suite: 839 tests across 96 files passed
  (`/tmp/cs203-mobile-web-final.log`). Existing contextual-link tests now reach
  the same authorized destinations through the agreed section menu; their route
  and selected-state assertions remain intact.
- Workspace type checks, `pnpm fix` and production web build passed
  (`/tmp/cs203-mobile-types.log`, `/tmp/cs203-mobile-fix-final.log`,
  `/tmp/cs203-mobile-build.log`). Biome reports its existing nonfatal type-budget
  warning while analyzing the generated contract.
- No server, database or API changes were needed for this follow-up. Docker
  integration was restored and all 1,449 backend tests passed.
- The normal local app was restarted on ports 3001/8080 against its existing
  Infisical configuration. The isolated Chrome session used real authentication for live checks; no test
  identity was injected.

## Resident reporting follow-up — built and verified 2026-10-28

The user reported that global Report a fault/My reports links silently leave a
Manager estate for an unrelated Resident estate. Before this follow-up, navigation showed these
links whenever the account had any Resident membership, while the creation form
automatically selected a sole eligible estate.

Agreed and implemented behaviour:

- While an estate is selected, show Report a fault and My reports in its section
  menu/sidebar only when that estate membership is Resident. Always include that
  estate ID in the link; Manager/Crew contexts do not show resident actions.
- Switching to a Resident estate opens its own reports and reveals its reporting
  sections; switching back restores only that estate's permitted staff sections.
- From global Home/Estates, retain access to reporting. Multiple eligible Resident
  estates require an explicit estate choice, rather than silently choosing one.
  A sole Resident estate may be opened with its name made visible.
- Preserve direct URLs to the caller's own historic reports, including history
  after membership removal. Navigation visibility never grants new API access.
- Implement with failing navigation/chooser regressions observed before changing
  application code. Report creation is offered only for current active resident
  assignments; inactive memberships retain My reports. Resident section order is
  My reports, Report a fault.

## Final verification, including reporting follow-up

- Resident navigation tests were added before implementation: nine new failures,
  839 existing passes (`/tmp/cs203-resident-red.log`). They cover selected staff
  estates, resident section links, explicit single-estate URLs, multiple-estate
  selection from desktop/mobile global entries and inactive resident history.
- Live QA reproduced an open mobile section popup remaining visible after a
  desktop resize. The new regression failed before the fix
  (`/tmp/cs203-mobile-resize-red.log`). EstateNavigation now mounts only below
  768px, so its popup unmounts together with the mobile trigger. The same resize
  and return to mobile passed in the browser (`/tmp/cs203-mobile-resize-fixed.log`).
- Final combined `pnpm test`: 849 web tests / 96 files and 1,449 backend tests
  passed. Backend integration tests ran against disposable Postgres after Docker
  was restored; final UI-only iterations reused those unchanged passing backend
  tasks. See `/tmp/cs203-mobile-combined.log` and
  `/tmp/cs203-mobile-ready-tests.log`.
- Final `pnpm fix`, workspace type checks and production web build passed:
  `/tmp/cs203-mobile-ready-fix.log`, `/tmp/cs203-mobile-ready-types.log`,
  `/tmp/cs203-mobile-ready-build.log`.
- Real browser checks passed at 320px/375px, desktop and short landscape: shared
  section order and routing, keyboard ArrowDown/Escape and focus restoration,
  mobile/desktop switching, reading cards and seven untruncated suspect results,
  numbered page jumps, mixed-source legacy readings and retired asset history.
- Mobile work-order sorting returned Urgent, High, Medium, Medium, Low, with the
  older Medium order first. Cards retained references, metadata and navigation.
- Real Resident TEST2 links retained its ID between My reports/Report a fault;
  switching to Crew Testing hid resident actions. Manager demo sidebar also hid
  them. Multiple-resident choices are covered by desktop/mobile automated tests;
  the live account has one Resident estate.
- One clearly labelled synthetic PDF (623 bytes) was uploaded through the normal
  Documents UI in the existing QA demo estate. Its long filename, permission-
  controlled actions, cancellation of Delete and the association dialog fit
  mobile widths; dark mode also passed. The document remains available for human
  exploration. No association or existing work-order/report data was changed.
- These are Chrome viewport/emulation checks, not physical-device verification.
  No commits, pushes or staged changes were made.
