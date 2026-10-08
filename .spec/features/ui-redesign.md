# Consistent application UI and design conventions

**Status:** implemented; current UI iteration accepted by the user (2026-10-09); Git merge and PR review pending
**Owner:** Chan Ding Jie
**Jira:** [ID-93](https://notjira.atlassian.net/browse/ID-93)
**Branch:** `feat/ui-redesign`
**Related feature branches:** `feat/council-invitation`, `feat/retire-assets`

## Problem

The interface exposes working estate-management features but has a minimal header,
unstructured detail screens and inconsistent presentation across forms, tables,
status labels and feedback. Users need to recognise the current estate, find its
assets and council controls, and complete tasks on smaller screens. Future features
also need written conventions instead of inventing a new layout on each screen.

ID-93 requires redesigning existing screens, preserving functionality/permissions,
using shadcn, supporting desktop/tablet/mobile and keyboard use, and documenting
shared design foundations. No separate design reference was found in Jira search;
some search sources were unavailable. The initial redesign is implemented. The
agreed refinement below addresses the user's subsequent 20-point UI/UX review;
the user approved implementing the reviewed plan on 2026-10-08.

## Branch and dependency gate

The UI branch initially began from main at bcbe67c and integrated the council
(dce91ba) and retirement (8f9ddc8) branches so implementation could proceed while
those PRs were under review. UI changes were saved separately in commit 2b381ba.

On 2026-10-08, both dependencies merged into main: Council PR #15 and retirement
PR #16. Updating feat/ui-redesign from main at 83cb09a incorporates their final
review fixes, including CouncilInvitationStatus and the @tests alias. The
redesign's PR comparison can now contain only the UI changes and documentation.

- Keep the shared-member active-location reads and owner-only historical reads.
- Resolve schema/API outputs using their reviewed definitions; never invent
  fields in generated jOOQ/API files. The UI adds no schema or endpoint changes.
- Combined feature testing uses the confirmed ui-redesign Neon child branch with
  both existing feature migrations. Git switching does not switch Infisical;
  database commands still require the intended feature target.
- Dependency reviews no longer gate the UI PR. Manual visual acceptance remains
  required before marking ID-93 complete.

## Design direction — agreed

The user chose a dashboard-style application with a desktop sidebar that becomes
bottom app-bar navigation on mobile (2026-10-08). Dashboard style describes the
layout and information hierarchy; it does not add an analytics dashboard or fake
metrics. Use readable grouped surfaces, a clear page heading and contextual actions.

Agreed palette: light background by default, navy primary actions and restrained
teal accents, with a visible light/dark mode switch. Preserve saved preferences
across refresh and navigation. Use the existing next-themes provider and semantic
shadcn CSS tokens. Both modes receive the full redesign, including dialogs and
popovers. The toggle is keyboard accessible and clearly names its resulting mode;
use an existing shadcn control rather than adding a new dependency.

- Neutral page background; surfaces/cards group related information. Avoid nested
  cards around every field and avoid decorative fake charts/statistics.
- Existing system font stack; a consistent type scale: approximately 28–32px page
  titles, 18–20px section headings, 14–16px readable content and controls. Avoid
  encoding meaning through bold or colour alone.
- Spacing based on existing Tailwind scale: 4/8/12/16/24/32px. Pages use consistent
  responsive gutters, rounded surfaces and borders; forms have a narrower reading
  width than tables. Long names/addresses/emails wrap without obscuring actions.
- Primary, secondary and destructive actions use the same Button variants across
  features. One primary action per page or independent task section. Destructive
  actions are separated from normal save/edit actions and show their impact.
- Status badges include words (Active, Inactive, Retired, Good, Needs attention,
  Faulty, Shared with you), optionally icons. Reuse existing lucide icons; no new
  icon/font dependency and no generated imagery is needed.
- Colour contrast targets: 4.5:1 normal text, 3:1 large text and meaningful control
  boundaries; verify both themes. Keyboard focus is visibly distinct.

## Behaviour

### Application shell and navigation — desktop sidebar / mobile bottom app bar

- Signed-out users see a compact public header and local home/sign-in/register
  pages. Signed-in users see an application shell. No authenticated data is fetched
  before the existing session/token bridge is ready.
- Desktop layout: roughly 240px sidebar, compact top bar containing brand,
  theme and account controls, and a scrollable dashboard content area. Below the
  medium breakpoint (initially 768px), the sidebar becomes a persistent bottom
  app bar. Tablet layouts use whichever arrangement fits without clipping; check
  both portrait and landscape. Keep the breakpoint documented and tokenised.
- Desktop global navigation: Home and Estates; Account via Settings in a circular
  top-right profile menu with Sign out. Mobile keeps Settings reachable. Admin users only
  for the existing admin role. Use "Estates" consistently in headings, navigation, breadcrumbs and
  invitation guidance; existing URLs and workflow semantics stay the same.
  Do not create dashboard/work-order/report destinations that lack
  implemented routes.
- Within an estate: Overview (including its Locations section), Assets (when
  current permissions support asset reads), and Council members (when the existing
  API capabilities permit it). Do not invent separate location or device-inventory navigation destinations.
- Remove the current-estate label and selector from the header on desktop and
  mobile, as explicitly requested on 2026-10-08. Estate context comes from the
  route, named breadcrumbs, page headings and desktop sidebar section. Users
  choose another estate through Estates; global pages do not fabricate context.
  Remove obsolete switcher-only code if it has no remaining consumers.
- Active destinations expose aria-current; breadcrumbs show an understandable
  path such as Estates / Estate / Assets / Asset. Names come from existing
  loaded records, with stable fallbacks during loading.
- Mobile app bar has icons plus visible text labels and no more than five
  destinations. It uses actual navigation links, not ARIA tabs for routed pages.
  The selected destination has aria-current plus a non-colour-only visual cue.
- Mobile navigation includes the main implemented features only. No damage-report,
  work-order or reporting placeholder appears before its feature is implemented.
  The documented navigation pattern can be revised when new features land; this
  story does not freeze the product navigation or build a speculative registry.
- Mobile mapping agreed for now on 2026-10-08: a fixed Home /
  Estates / More bottom bar, plus Overview / Assets / Council links within estate
  pages. These contextual links are route navigation, not ARIA tabs. Assets and
  Council appear only when current capabilities allow them. More includes Settings
  and permitted Admin users navigation; Sign out remains in the profile menu.
  This replaces the implemented estate-aware bottom bar; the user chose the
  recommendation provisionally and it remains subject to visual acceptance.
  Every allowed desktop destination remains reachable.
- Keep the mobile header to brand, theme toggle and profile control, with compact
  spacing and accessible touch targets. Estate names belong in the content, not
  another header row. Direct links and navigation use the route's estate ID.
- Use the existing shadcn Button/link styles and lucide icons for bottom-bar items,
  with DropdownMenu for More. Add app layout composition rather than installing
  new Sidebar/Sheet dependencies. More supports keyboard interaction and returns
  focus to its trigger on dismissal; close it after navigation.
- Account for the bottom safe-area inset (env(safe-area-inset-bottom)) and reserve
  matching content padding. The bar must not obscure the last table row, alerts,
  Save/Cancel controls or focused inputs. Check short screens and the mobile
  keyboard; dialogs and their footers remain reachable independently of the bar.
- Provide a skip-to-content link and one main landmark per screen. AuthKit guards,
  sign-in return paths, CSRF, token forwarding and session expiry continue working.

### Screen rollout and refinement layouts — agreed

| Screen(s) | Proposed layout and primary task | Behaviour retained |
| --- | --- | --- |
| Local Home `/` | Agreed signed-in estate overview, pending-invitation summary and permitted Open/Create actions; public sign-in/Create account entry stays concise | Existing data only; no fabricated statistics, automatic invitation acceptance or new analytics |
| `/login`, `/register`, `/logout`, `/account` | Consistent narrow auth/account surface, descriptive headings and existing hosted-auth actions | WorkOS-hosted authentication stays hosted; account fields remain read-only |
| `/estates` | Page heading + Create estate; status filter; readable estate cards with status/ownership; invitation section with distinct feedback | Owner/shared estates, pending invitations, explicit acceptance and retries |
| Estate create/edit | Grouped identity/address fields, required indicators, inline errors, Save/Cancel footer | Existing fields, validation and navigation; no extra required data |
| Estate overview | Compact name/status/details summary, grouped Edit/Council/Deactivate actions; clear Locations and Assets sections | Owner edits/deactivation, existing member reads and per-feature capabilities |
| Locations section | Readable block groups and expandable level/common-area lists; contextual action menus; short forms in dialogs if agreed | Hierarchy, parent/order rules, search and current mutation permissions |
| Asset register | Desktop table; mobile cards with all fields; compact mobile search and secondary-filter dialog | All filters and URL state, ordering by reference, Clear filters and retry |
| Asset create/edit | Group core details/location and optional equipment metadata; clear save/cancel; reference read-only on edit | Existing reference generation and active-asset edit restrictions |
| Asset details | Compact metadata summary; distinct lifecycle, condition and device sections with readable histories | Retirement/correction/restoration, complete history, devices/assessments |
| Assessment/device forms and lists | Assessment dialog and device registration page; clear field groups and metric choices; readable history/device cards | Current assessment ordering, metrics, constraints and input retention on failure |
| Council members | Small email-only invitation form; compact pending invitations and separate member-permission controls | Owner/delegate boundaries, email versus in-app delivery, cancellation/removal confirmations |
| Admin users `/admin/users` | Clear organisation/search controls; desktop table and mobile member cards; focused estate-access editor | Existing admin-only route, WorkOS roles, multi-role restrictions and estate access |
| Loading/error/not-found states | Consistent page-level headings and recovery navigation; retry where supported | Real errors retained without exposing SQL or internal implementation details |

Preserve existing route URLs and folder-based routing. A device registration page,
if the form policy is agreed, adds only a frontend route under the existing asset
directory and calls the existing registration endpoint. Move route-only UI extracted
from an index file to its adjacent `-components/` folder. Do not introduce new
business pages just to populate a navigation mockup.

### Shared components and feedback

- Reuse shadcn Button, Card, Input, Select, Checkbox, Textarea, Field, Table, Dialog,
  DropdownMenu, Badge, Alert, Empty, Skeleton/Spinner, Separator, Tooltip and Sonner
  already present in packages/ui.
- Add small app-level shared pieces only for repeated patterns established by this
  redesign: application navigation/layout, PageHeader (breadcrumbs/title/description/
  actions) and FormActions (save/cancel/pending). Keep feature forms and mutation
  logic local; do not build a schema-driven form/table engine.
- Forms use grouped labelled fields, required/optional indication, format help and
  actionable errors linked with aria-invalid/aria-describedby. Errors explain why
  a filled form cannot submit, including retirement date bounds.
- Pending submissions prevent duplicate saves; success uses existing toasts plus
  persistent state updates where relevant. Failures retain inputs and saved values.
- Destructive confirmations identify the asset/member/invitation/estate and state
  the actual effect. Preserve exact-reference/code requirements; cancelling makes
  no request. Pending confirmations cannot be dismissed into an unknown state.
- Loading announcements are concise. Empty states distinguish no data from no
  filter match and offer an allowed next action. Errors offer Retry when supported;
  invitation failure must not prevent the rest of Estates from working.
- Preserve React Query session gating, user-scoped keys, mutations and invalidations.
  Any extraction of an existing inline request uses the current generated client
  and contract; it does not introduce an endpoint or change payload semantics.

### Responsive and accessible behaviour

- Verify 360px phone, 768px tablet and 1280–1440px desktop widths, plus 200% zoom.
  Page content, filters, breadcrumbs and form footers wrap without horizontal page
  overflow or hidden actions. Date controls retain native input behaviour.
- Assets and Admin Users use cards below 768px, retaining every relevant table
  field and action without requiring horizontal scrolling. Desktop tables retain
  their labelled, keyboard-reachable overflow container when necessary. No new
  sorting/pagination is required; do not silently omit narrow-screen data.
- Dialogs fit short viewports with scrollable contents and reachable confirmation/
  cancel controls. Focus enters the dialog and returns to its trigger on dismissal.
- All actions work using keyboard, with visible focus and descriptive names.
  Decorative icons are hidden from assistive technology; icon-only controls need
  labels. Prefer comfortable touch targets around 44px for main mobile actions.
- Theme/navigation must not create hydration warnings or a flash of authenticated
  content during sign-in. Read saved theme/client-only state through existing
  provider mechanisms.

### Permissions and functional boundaries

- Admin visibility uses the existing admin role; estate owner/delegate capabilities
  continue to come from the estate API. A council delegate is not an application
  admin, and the redesign does not grant asset writes/reads to new roles.
- Inactive estates and retired assets preserve current read/write restrictions.
  UI cannot advertise an action that is impossible without explaining its state.
- Invitation rules, account reuse, permission revocation and pending-invitation
  acceptance keep the agreed council feature behaviour.
- Retirement keeps Singapore ISO dates, confirmation, optimistic version conflicts,
  audit history and preserved identity. Asset filtering uses the latest assessed
  condition; row ordering remains by reference, not most recently updated.

## Data

No Prisma model, migration, seed or data reset belongs to this UI story. Use the
existing Estate, Location, Asset, AssetAssessment, Device, EstateUser and
EstateInvitation data after their feature branches are integrated. Theme preference
uses existing next-themes storage, not a new database setting.

## API

No endpoint or DTO changes are planned. Existing generated contracts remain the
source of truth. New metrics, permission fields or backend role changes need their
own agreed scope rather than becoming implicit parts of a visual redesign.

| Existing surface | Requests | Response/auth | Redesign use |
| --- | --- | --- | --- |
| `/health` | GET | Existing public health response | Existing diagnostic surface; not a primary signed-in Home task |
| `/estates`, `/estates/{id}` and estate actions | Existing GET/POST/PATCH/deactivate | Existing generated estate responses and access checks | Cards, context, forms and actions |
| `/estates/{estateId}/locations` and location actions | Existing hierarchy queries/mutations; includeInactive for asset filters | Existing location DTOs/permissions | Hierarchy, location pickers |
| `/estates/{estateId}/assets` and detail/lifecycle paths | Existing list/create/edit/retire/correct/restore/history | Asset and lifecycle DTOs; current owner-only checks | Register/detail/lifecycle screens |
| Asset assessments and devices | Existing history/register requests | Existing generated DTOs and constraints | History and forms |
| Council invitations, acceptance and member permission/access paths | Existing query/mutation requests from council branch | Existing recipient/owner/delegate checks | Invitations and access management |
| `/admin/*` | Existing organisations/members/roles/estate-access requests | Existing admin-only contracts | Admin management |
| `/api/auth/*`, `/logout` | Existing auth redirects/session handlers | Existing AuthKit flow | Local auth presentation/navigation |

If a controller unexpectedly must change, stop and explain the requirement; after
agreement, follow the normal API generation loop. Styling alone should not require it.

## Edge cases

- Long names/references/emails, missing optional metadata and empty estate/location/
  asset/member lists; narrow tables and many filter controls.
- Owner versus member/delegate versus admin navigation, sign-out/user switch,
  revoked access and expired sessions; no cross-user cache or context leakage.
- An inactive estate, a retired/legacy-retired asset, unavailable WorkOS, failed
  invitation reconciliation and an in-app invitation that must not claim an email.
- Back navigation preserving register filters; direct links to nested screens;
  navigating between estates while another query is loading.
- Request failures, pending submissions and stale-version conflicts: do not hide
  real failures behind a success-looking UI or discard entered information.
- Dialog focus with long contents, bottom-bar overflow dismissal, keyboard-only use,
  zoom, safe-area insets and the on-screen keyboard.
- Both themes; saved preference; initial SSR/hydration before client auth is ready.

## Baseline implementation evidence and checks

- [x] Agree design/navigation decisions and this scope; establish the combined
      branch/database baseline and run existing checks before any redesign.
- [x] Write and run failing shell tests for selected navigation, estate context,
      role visibility, bottom app-bar destinations/More reachability, skip link
      and saved theme selection. Implement tokens and repeated layout pieces;
      actual keyboard focus and content clearance remain in browser review below.
- [x] Write and run failing tests for the Estates label/retry and shared form
      Save/Cancel/pending behavior. Restyle estate/location screens and retain
      existing validation, destructive-confirmation and failure-retention tests.
- [x] Verify asset filter/back-navigation, status, date and lifecycle regressions;
      add failing tests for labelled table scrolling and inactive-estate action
      feedback. Restyle register/detail, assessments/devices and lifecycle screens.
- [x] Restyle council screens while preserving existing owner/delegate/member,
      delivery, acceptance, cancellation/removal and failure-retention regressions.
- [x] Restyle local auth/account/home/admin screens with failing tests for any new
      observable behaviour. Preserve existing AuthKit and admin tests.
- [ ] Verify desktop/tablet/mobile and both themes in an actual browser, including
      keyboard, contrast, 200% zoom, long content, scrollable tables and dialogs.
      Do not assert CSS class names or screenshots alone as evidence of correct
      behaviour. Do not claim jsdom proves responsive layout or colour contrast.
- [x] Run pnpm test, pnpm check-types, web build and pnpm fix. Run targeted tests
      during each loop; retain a final full regression run for branch integration.
- [x] Update `.docs/frontend/design-system.md`, `.docs/frontend/shell.md` and every
      touched feature's frontend doc; index the guide in `.docs/README.md`. Record
      architecture/layout decisions in an ADR only where a tradeoff needs rationale.

Vitest tests mirror src folders and use accessible role/name queries and the
existing renderWithProviders. No new test or UI dependency is assumed. Browser
checks use existing tooling/manual review if an automation tool is unavailable.

## Documented conventions deliverable

The design-system guide will describe actual tokens/themes, type and spacing scale,
page widths/headers/breadcrumbs/actions, navigation and permission visibility,
form grouping/help/validation, button hierarchy, statuses/icons, tables, dialog
focus/confirmations, loading/empty/error/success patterns, desktop sidebar/mobile
bottom app-bar mapping, overflow, safe-area spacing and mobile behaviours.
Include examples using the actual shared pieces, plus guidance for a future screen.
`.docs/` describes the completed system; this spec describes the proposed work.

## Out of scope

- New estate/asset/council/admin capabilities, dashboards with new metrics,
  maintenance/work-order/reporting features, bulk actions and new table sorting.
- Database/API/role-policy redesign, business-rule changes, deletion/reset of data,
  or merging other feature PRs into main as part of the redesign.
- Replacing AuthKit's hosted login/signup with local credential forms.
- New dependencies, fonts, illustration packages or a generic component framework.
- Restyling external WorkOS/Neon/Jira dashboards or redesigning future unbuilt pages.

## Implementation timing — agreed (2026-10-08)

The user chose to begin while both dependency PRs awaited review. Their original
implementations were integrated into feat/ui-redesign, with UI changes saved
separately. Both dependency PRs have since merged into main; their review fixes
are incorporated when updating this branch. Shared main/dev are not deployment
targets for UI development. The agreed design and scope above remain the baseline.

## Agreed design decisions (2026-10-08)

- Dashboard style, desktop sidebar, mobile bottom app bar.
- Default light background with navy/teal accents and a light/dark mode switch.
- Use Estates instead of My estates throughout the redesigned interface.
- Mobile navigation features the main functions currently implemented. Damage
  reporting and other future features join navigation only when delivered.
- Keep additional destinations reachable through More and respect the current
  estate and existing permissions. The initial mapping is a recommendation for
  the current set of features, not a permanent list for future releases.

## Implementation evidence (2026-10-08)

### Account navigation refinement — agreed (2026-10-08)

Move desktop Account navigation from the sidebar to a circular profile button
at the top right. Its existing shadcn DropdownMenu shows the signed-in email,
Settings linking to the current `/account` screen, and Sign out using `/logout`.
The account screen remains read-only; no new settings capabilities are implied.
Preserve Account in mobile bottom navigation/More and keep public login controls.

### Estate navigation/action refinement — agreed (2026-10-08)

Locations remains a section of Overview, with no separate sidebar or mobile
More destination. Overview stays selected for its section anchors. Group the
Council members link with Edit estate and Deactivate estate in a single wrapping
action row, preserving all current owner/delegate visibility checks.

### Status and asset context refinement — agreed (2026-10-08)

Use green Active badges and red Inactive estate / Retired asset badges in lists
and details, retaining visible labels in both themes. Asset register, details and
create/edit breadcrumbs display the estate's actual name via the existing cached,
session-gated useEstate query. Keep a temporary Estate fallback while loading.

### Public home actions refinement — agreed (2026-10-08)

Keep one Create account action in the home content and remove the duplicate
Register header link. Use Sign in consistently in the header and home content.
Existing sign-in/signup routes and hosted authentication behavior are unchanged.

Existing council and retirement behaviors retained their regression tests; no new
business rule was needed for their visual restyling. New observable behavior was
written and observed failing first: shell/context/capability visibility, saved
theme toggle, PageHeader, estate retry/label, FormActions cancellation/pending,
Home entry actions, labelled keyboard table scrolling, missing-page recovery and
safe 5xx feedback and inactive-estate registration guidance. More items are tested; real keyboard focus, viewport clearance
and rendered responsiveness remain in the manual browser phase above.

The confirmed UI Neon branch received the two existing feature migrations and
jOOQ/API artifacts were regenerated for the combined baseline. No ID-93 migration
or API contract change was introduced. Integration passed its original backend
and frontend regressions before the redesign. The as-built design guide and ADR
0025 record implementation and branch decisions. Review ID-93 visually before
calling it complete. Both dependency PRs are now merged; the remaining gate is
UI acceptance.

## UI/UX refinements — agreed (2026-10-08)

The user supplied a 20-point review and requested plan review before application
changes. Code inspection confirms wide Assets/Admin Users tables, stacked asset
filters, multiple location-row buttons, inline location/assessment/device forms
and introductory Home content. Theme support, profile controls, named estate
breadcrumbs, lifecycle colours and bottom-bar safe-area spacing already exist;
refine these rather than add duplicate implementations. Spacing, wrapping and
visual hierarchy findings still need actual viewport review.

### Confirmed direction

- Confirmed: no current-estate label or selector in either header. Keep brand,
  theme and profile controls, with estate context in content/sidebar.
- Mobile navigation: fixed Home / Estates / More bottom navigation with contextual
  Overview / Assets / Council links in estate pages. The user chose this
  recommendation for now; evaluate it during visual acceptance.
- Form presentation: agreed full pages for estate, asset and device
  registration/editing; dialogs for short location and assessment tasks; dialogs
  for destructive confirmations; email invitation remains a small inline form.
  Agreed when the user authorised implementing the plan on 2026-10-08. Account settings
  and theme behaviour remain as implemented; no drawer dependency is needed.
- Signed-in Home: agreed accessible-estate overview, pending-invitation summary
  and permitted Open/Create quick actions using existing queries (2026-10-08).

The user approved implementing the reviewed plan on 2026-10-08, including the
recommended form presentation. Mobile navigation remains subject to visual acceptance.

### Coverage of the user's review

| # | Priority / finding | Planned refinement |
| --- | --- | --- |
| 1 | High — crowded mobile header | Remove estate controls in both headers; compact brand/theme/profile layout and comfortable touch targets. |
| 2 | High — mobile tables | Asset and Admin User cards below 768px; desktop tables remain. Preserve fields, actions and ordering. |
| 3 | High — location hierarchy | Distinct block groups, readable expandable level/common-area lists, consistent indentation and labels. Search retains full paths. |
| 4 | High — location actions | One labelled Actions menu per node with permitted Add/Edit/Deactivate choices; destructive confirmation remains explicit. |
| 5 | High — inconsistent forms | Apply the agreed page/dialog/inline policy; consistent labels, Save/Cancel, pending states and retained inputs on errors. |
| 6 | High — unclear buttons | Use shared Button variants for actions; keep ordinary breadcrumbs/data links recognisable as links. Label icon-only actions. |
| 7 | High — mobile navigation | Fixed Home / Estates / More plus contextual estate links; retain permission visibility, selected state, safe-area spacing and content clearance. |
| 8 | High — small-screen wrapping | Responsive gutters, action wrapping, long-text handling and reachable dialog/form controls; no horizontal page overflow. |
| 9 | Medium — whitespace | Reduce repeated section gaps and oversized card padding where observed, preserving useful grouping and touch targets. |
| 10 | Medium — typography | Apply the existing title/section/body scale consistently; clear labels and secondary descriptions in both themes. |
| 11 | Medium — Home | Agreed signed-in estate summary and useful existing-data actions; public authentication entry remains simple. |
| 12 | Medium — estate overview | Compact summary, management actions together, distinct Locations/Assets entry points and visible member context. |
| 13 | Medium — asset details | Group metadata, lifecycle, current condition/history and devices; compact record layout without losing history or actor/date information. |
| 14 | Medium — assessments | Record assessment dialog with Cancel; current-condition summary and clearly ordered history remain on the page. |
| 15 | Medium — device registration | Focused page grouped into identity, location, supported metrics and reporting; readable metric names/units and responsive choices. |
| 16 | Medium — council | Separate inviting, outstanding invitations and member permissions; compact cards, delivery/expiry labels and clear save/remove feedback. |
| 17 | Medium — Admin Users | Readable member information, compact organisation/search controls, role controls and focused estate-access editing; mobile cards. |
| 18 | Medium — filters | Search stays visible; mobile secondary filters open in a dialog with draft Apply/Clear/Cancel; compact desktop grid. |
| 19 | Medium — empty states | Distinguish no records from no matches; offer permitted next actions, clear filters or retry as appropriate. |
| 20 | Medium — statuses | Reuse lifecycle badges; consistent labelled condition badges: Good green, Needs attention amber, Faulty red, unassessed neutral. |

### Mobile collections and asset filters

- Asset cards show linked name and reference, category, complete location path,
  latest condition and lifecycle status. Admin cards show member name/email,
  existing roles and permitted role/estate-management controls. Do not truncate
  essential values or render separate desktop/mobile result trees simultaneously.
- A reactive media-query subscription selects cards or table, using a stable
  server snapshot for hydration. Reuse the existing query data; resizing must not
  change filters, selected members or trigger a second list request.
- Below 768px, keep Search assets visible with a Filters button. The count includes
  applied category/location/condition/nondefault-status filters, excluding search
  and the default Active status. Desktop retains immediate filter changes.
- Mobile filter edits remain a draft until Apply updates the current route search
  parameters. Cancel/X/Escape discard drafts. Reopening starts from applied values.
  Clear in the dialog resets secondary draft filters to Active and retains search;
  page-level Clear filters still resets all applied filters and search.
- Preserve search debounce, generated filter types, URL/back-navigation state,
  order by asset reference, loading/error/retry behaviour and inactive-estate rules.
  Keep all filters reachable; no new pagination, sorting or backend requests.

### Locations, forms and detail screens

- Use existing Card, Button and DropdownMenu primitives for location groups and
  actions. Expand/collapse controls expose their state and have descriptive names;
  do not add an Accordion/Collapsible dependency. Search matches remain readable
  with the full path, and allowed actions use the same contextual menu.
- Location Add choices depend on node type. Preserve parent selection, level
  ordering and validation; shared users retain active-location reads without
  management controls. Deactivation remains permanent under current rules.
- Under the agreed form policy, short forms open in existing Dialogs;
  long forms have a full page with Cancel back to the relevant parent. Assessment
  creation uses the existing fields, date rules and endpoint. Device registration
  may add `/estates/$estateId/assets/$assetId/devices/new` with a route-local form
  calling the existing endpoint. No backend device capability is added.
- Keep pending submissions visible, block duplicate saves and destructive-dialog
  dismissal while pending, retain inputs on failure, and return focus on dialog
  dismissal. Existing retirement/correction/restoration confirmation and version
  rules remain unchanged. Preserve history ordering and latest-condition selection.
- Lifecycle records retain recorded actor identifiers and Singapore dates/times;
  do not fabricate names or introduce an identity lookup endpoint for styling.
  Device lists already use cards; refine their hierarchy rather than duplicate it.

### Home, council, admin and shared feedback

- Home reuses the session-gated accessible-estate list and pending
  invitation queries. Show owned/shared context and genuine statuses, an Open
  action, and Create estate where allowed. Link invitation summaries to Estates
  for explicit acceptance; do not relocate automatic email reconciliation to Home.
  No per-estate asset-count fan-out, invented analytics or new dashboard endpoint.
  Service/database diagnostics must not dominate the user's workspace.
- Council keeps email-only invitation, correct delivery/expiry copy and separate
  owner/member-permission controls. Replace leftover “My estates” invitation copy
  with “Estates”. Keep immediate permission-save feedback, cancellation/removal
  confirmations and all current owner/delegate/inviter-revocation rules.
- Admin keeps WorkOS organisation scoping, existing multi-role restrictions and
  role mutations. Estate access editing identifies the selected member and remains
  focused in a Dialog; organization changes reset stale selection. No new
  role policy or multi-role editor is implied by the layout changes.
- Consolidate repeated visual patterns only where actually shared. Empty states
  offer capability-appropriate actions; an unavailable request is an error, not
  an empty list. Status labels remain readable without colour. Do not invent
  device connectivity states or persist an expiry status solely for a badge.

### Refinement implementation and verification

Each behaviour change begins with an observable failing test, run before its
implementation; reuse existing regression coverage for preserved workflows.

- [x] Agree the form choice and approve the updated plan; mobile mapping
      is provisionally chosen and still requires visual acceptance.
- [x] Shell/mobile collections: test removal of header estate controls, reachable
      destinations/selected state, permission visibility, all card fields/actions,
      resizing and filter Apply/Clear/Cancel/reopen/URL behaviour. Implement compact
      layout and typography refinements, preserving desktop behaviour.
- [x] Estate/locations/forms: test hierarchy disclosure, menu choices per node and
      permission, dialog cancellation, valid submissions and failed-input retention.
      Improve estate summary/action grouping and location presentation.
- [x] Asset details: test assessment/device form navigation and cancellation,
      pending/error behaviour and current-condition/history readability. Preserve
      lifecycle regression tests and all device/date/metric constraints.
- [x] Home/council/admin: test real data, allowed quick actions, independent failures,
      empty-versus-filtered states, invitation destination/copy, selected-member
      estate editing and role controls in both presentations.
- [ ] Browser review at 360px, 768px and 1280–1440px, both themes, keyboard and 200%
      zoom: hierarchy, spacing, contrast, long names/paths/emails, safe-area clearance,
      short dialogs and mobile keyboard. jsdom cannot prove these visual properties.
- [x] Run pnpm fix, pnpm check-types, pnpm test and web build through existing Nx
      targets. No installs or database deployment are needed for this refinement.
- [x] Update as-built frontend design-system/shell/estate/location/asset/assessment/
      device/council/admin documentation and index only as implementation lands.
      Record any agreed navigation/form convention change in the existing UI ADR.

Use existing shadcn primitives, generated contracts, session gating, user-scoped
queries and invalidations. Render one responsive list presentation from shared
data. Private data remains browser-fetched through Spring; this redesign does not
promise pagination, a slow-device benchmark or a different rendering architecture.

### Refinement verification evidence (2026-10-08)

Observed failing tests before implementing header/navigation changes, mobile
asset cards/filter drafts, location menus/dialogs/disclosure, assessment dialog,
Home data/quick actions, mobile Admin Users, dedicated device registration and
council guidance/save feedback. Existing form, invitation, lifecycle and role
regressions remain. Device page tests mirror its new route directory; obsolete
estate-switcher tests were removed with the unused component.

Final pnpm fix, pnpm check-types, pnpm test and web build pass. The backend rerun
passed 203 tests after one transient disposable-container connection failure;
final workspace tests pass with valid unchanged-task cache entries. Source files
have no conflict markers and documentation links resolve. Manual viewport,
keyboard/focus and contrast acceptance remains outstanding; ID-93 is not complete.
The prior main merge still awaits staging/commit; application changes are saved
in the current working tree, without a new commit or push.

## Home/Estates differentiation — approved follow-up (2026-10-08)

The user found the implemented Home estate cards repetitive with Estates and
supplied a multi-estate dashboard suggestion. See
[portfolio-home-and-estate-directory.md](portfolio-home-and-estate-directory.md)
for the distinct page responsibilities. The user approved implementation on
2026-10-08, including backend aggregation and the attention definition.
Home now uses portfolio summaries; Estates remains the searchable directory.
This agreed backend scope extends the original UI-only API boundary and uses
the normal test-first/controller/contract generation workflow.


## Location browsing refinement (2026-10-09)

**Status:** implemented from the user's supplied changes; visual acceptance pending.

- Start all blocks/levels collapsed on first visit. A branch's whole name/count
  row is a shadcn Button for expansion; keep the Actions menu a separate sibling.
  Empty branches have no fake disclosure. Native buttons support keyboard/touch.
- Blocks show level count and all common areas within the block (both direct and
  within levels); levels show their common-area count. Count active locations
  from the full existing response, not just matches remaining after search.
  Use singular/plural labels including zero and update after existing mutations.
- Search ignores case and whitespace as before, but shows a filtered hierarchy
  with matching locations and their parent chain automatically revealed.
  A matching block/level includes its descendants. Search context stays open,
  with no misleading collapse action while the search is active. Clearing search
  restores the user's manual expansion choices.
- Retain manual expansion IDs by signed-in user and estate in the existing
  per-router QueryClient for the app's lifetime. Leaving Overview for an asset
  and returning restores that estate's choices. A different estate starts
  collapsed; a different account has independent choices. No browser-storage
  persistence across reload or new backend endpoint is required.
- Preserve existing permissions, ordering, dialogs and menu actions. Write
  failing tests first for default state, row-sized controls, counts/search
  context, clearing search, separate menus, navigation restoration and isolation.
  Update frontend locations docs and run relevant web checks.

Location refinement evidence: four new tests were observed failing before the
implementation; the final 17 location tests and the full web suite pass, as does
the web build. Previous assertions for initially expanded nodes and flat search
results were updated to the explicitly requested collapsed/contextual behaviour.
Tests await React Query's asynchronous UI-state notifications rather than fixed
delays. Docs cover count scope, per-user/estate memory and reload semantics.

## Contextual estate switching (2026-10-09)

**Status:** implemented after user approval; visual acceptance pending.

- Replace the desktop sidebar's estate heading with a shadcn DropdownMenu
  showing the current estate name. Place the same control above the estate
  links on mobile; keep the global header and bottom bar unchanged.
- Reuse authenticated `GET /estates?status=ALL` through `useEstateList("ALL")`.
  List only accessible estates, with name/code and an Inactive label where
  applicable. Mark the current estate. Preserve shared and inactive estate
  visibility and current permission boundaries.
- Selecting an estate opens its Overview, without carrying the previous
  estate's asset IDs, filters or section anchors. Features use the selected
  estate's own capabilities; do not retain old-owner controls while loading.
- Show loading, empty and retry feedback in the menu. Keep the current route
  on failure. Do not add remembered-estate browser storage or a new API.
- Mount only on estate routes, not Estates/new/Home. Reuse the existing
  account-scoped query/cache so account switching cannot expose previous data.
- Write failing navigation tests first for desktop/mobile destinations,
  current/accessible choices, permissions after switching, errors/retry and
  account isolation. Update shell docs and the navigation decision.

Verification: four switcher tests were observed failing before implementation.
The navigation tests use the real router and generated API response types;
an account-change test uses a reactive AuthKit mock within the same query cache.
Additional loading/empty feedback regressions are covered. Full uncached
`pnpm test`, workspace type checks, formatting and web build pass. No schema,
API, database or Git staging changes were required. Manual checks should cover
desktop/mobile placement, long estate names, keyboard selection/focus and both
themes.

## Code review cleanup (2026-10-09)

The user requested a redundancy/refactor review while manually testing the UI.
Keep presentation, permissions and routes unchanged:

- Build desktop/mobile/More navigation destinations directly and subscribe to
  pathname instead of the entire router location.
- Filter the existing location tree directly through `filterLocationTree`,
  preserving name matching, parent context, ordering and full counts. Remove
  the obsolete flat-search helper and unused location-type label export.
  Append siblings to fresh tree-builder arrays rather than copying each growing
  sibling group on every insertion. Reuse one title helper for dialogs/forms.
- Memoize the asset register's location options by response data, and retain
  stable retry callbacks.
- Remove the estate directory's unused local filter fallback. Its route already
  supplies URL-backed filters; isolated screen tests now supply a controller.

Existing screen/navigation tests were run green before cleanup. Four tests for
the replacement tree filter were observed failing before implementation; the
obsolete flat-helper tests were replaced because their unused API was removed,
while the hierarchy screen regressions and their assertions remain unchanged.

Verification: the full uncached workspace test suite passes, including all 211
Java tests; workspace type checks, `pnpm fix` and the production web build pass.
Documentation reflects the helper/controller changes. No schema, API or database
changes were made. The earlier Git merge still has unmerged index entries and
awaits staging/commit; this review did not stage, commit or push work.

## Filter alignment and mobile asset-card taps (2026-10-09)

Approved through the user's direct UI feedback. Match Estates filter label sizes,
control heights and spacing; use flex field wrappers with bottom-aligned grid
items. Keep the mobile search row and paired dropdowns. Make each mobile asset
card one routed link covering the entire card, with its name/reference as the
accessible label, all existing data and keyboard/hover/pressed feedback. Remove
nested name/reference links; desktop table links remain. The real-router test
was observed failing before implementation and checks tapping location metadata
opens details and Back restores the register URL. CSS geometry needs manual
browser confirmation; jsdom cannot verify alignment.

Verification: workspace tests, final type checks, formatting and web build pass.
The final 14 focused estate/asset tests pass, including real whole-card navigation
and Back behavior. The prior mobile test now expects one name/reference-labelled
link instead of the two text-only links, matching the user's requested change.

## Readiness (2026-10-09)

The user confirmed the current iteration looks good after the filter/card fixes.
Automated workspace tests, type checks, formatting and the production web build
pass. The detailed keyboard/zoom checklist remains a manual verification guide;
individual results for every item have not been recorded. Earlier visual-pending
notes above describe their verification state at the time.

Implementation is ready for PR review. The existing merge from main still has six
unmerged index entries, although the working files have no conflict markers.
Finish staging the reviewed resolutions and committing before pushing
`feat/ui-redesign`. ID-93 should remain In Progress until the PR is approved and
merged; this readiness check does not transition Jira or stage/commit/push Git.
