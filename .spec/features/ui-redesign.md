# Consistent application UI and design conventions

**Status:** agreed (2026-10-08) — implementation starting on combined feature branches
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
some search sources were unavailable. The design below is a proposal.

## Branch and dependency gate

Inspection on 2026-10-08: the working tree is clean on `feat/ui-redesign`, based on
main at bcbe67c. It does not yet contain either pending feature. The council branch
is dce91ba and retirement branch is 8f9ddc8. Their screens were inspected read-only
from those branches when preparing this plan.

- Final scope includes the invitation and retirement screens. Prefer starting
  their implementation phases once both PRs merge and the UI branch incorporates
  the latest main.
- If development begins before their merge, integrate both committed branches into
  the UI branch first, resolve overlaps and establish a passing baseline. Keep
  the UI PR Draft: its comparison against main initially includes dependency work.
  After both dependencies merge, merge updated main, resolve any remaining
  conflicts and verify that the UI PR contains only redesign changes.
- Regenerate conflicting database/API outputs from the combined source/schema;
  never resolve generated jOOQ/API files by inventing missing fields by hand.
- Combined feature testing uses a dedicated Neon child branch with both feature
  migrations. Git branch switching does not switch Infisical. Confirm both secret
  folders target the same combined feature database before any migration command.
- This planning task does not merge branches, apply migrations or modify application
  code. Implementation starts only after this draft is agreed.

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
- Desktop layout: roughly 240px sidebar, compact top bar containing current
  estate/account controls, and a scrollable dashboard content area. Below the
  medium breakpoint (initially 768px), the sidebar becomes a persistent bottom
  app bar. Tablet layouts use whichever arrangement fits without clipping; check
  both portrait and landscape. Keep the breakpoint documented and tokenised.
- Global navigation: Home, Estates, Account; Admin users only for the existing
  admin role. Use "Estates" consistently in headings, navigation, breadcrumbs and
  invitation guidance; existing URLs and workflow semantics stay the same.
  Do not create dashboard/work-order/report destinations that lack
  implemented routes.
- Within an estate: Overview, Locations (anchor within overview), Assets (when
  current permissions support asset reads), and Council members (when the existing
  API capabilities permit it). Do not invent separate locations/device pages.
- Retain the current estate switcher and its URL/remembered-estate behaviour.
  Selecting an estate changes all estate-scoped navigation consistently. Global
  pages do not pretend an estate is selected just to populate navigation.
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
- Initial mobile mapping: outside an estate, Home / Estates / Account, with
  More only when additional allowed destinations such as Admin users are present.
  Inside an estate, Estates / Overview / Assets / Council / More; Assets and
  Council appear only when current capabilities allow them. More exposes Home,
  Account, Locations and admin navigation where applicable. Every desktop
  destination remains reachable; do not invent a route for an overflow item.
- Keep the current estate name/switcher in the mobile top bar so bottom-bar actions
  have an unambiguous estate context. Switching estates updates destination URLs
  and permission visibility; an unrelated/global page does not fabricate context.
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

### Screen rollout and concrete layouts

| Screen(s) | Proposed layout and primary task | Behaviour retained |
| --- | --- | --- |
| Local Home `/` | UpKeep title, concise explanation, existing sign-in/Estates entry; current health status as secondary information | Existing health check remains available; no fabricated statistics |
| `/login`, `/register`, `/logout`, `/account` | Consistent narrow auth/account surface, descriptive headings and existing hosted-auth actions | WorkOS-hosted authentication stays hosted; account fields remain read-only |
| `/estates` | Page heading + Create estate; status filter; readable estate cards with status/ownership; invitation section with distinct feedback | Owner/shared estates, pending invitations, explicit acceptance and retries |
| Estate create/edit | Grouped identity/address fields, required indicators, inline errors, Save/Cancel footer | Existing fields, validation and navigation; no extra required data |
| Estate overview | Header with estate name/status; details in a summary surface; Locations and Assets sections; clear contextual actions | Owner edits/deactivation, existing member reads and per-feature capabilities |
| Locations section | Clear hierarchy/indentation and search; action groups per node; consistent inline forms | Block/level/common-area hierarchy and current mutation rules |
| Asset register | Wide content layout; wrapping search/filter toolbar; current-condition/status badges; accessible linked rows | All filters and URL state, existing ordering, Clear filters and retry |
| Asset create/edit | Group core details/location and optional equipment metadata; clear save/cancel; reference read-only on edit | Existing reference generation and active-asset edit restrictions |
| Asset details | Name/reference/status header; grouped metadata; lifecycle, condition history and devices as separate sections | Retirement/correction/restoration, complete history, devices/assessments |
| Assessment/device forms and lists | Consistent field labels/help/errors, readable history entries, compact actions | Current assessment ordering, metrics and device constraints |
| Council members | Email invitation form; pending invitation list; member permissions/access management as distinct sections | Owner/delegate boundaries, email versus in-app delivery, cancellation/removal confirmations |
| Admin users `/admin/users` | Clear organisation context, existing role/access table, visible saving/errors | Existing admin-only route, WorkOS organisation roles and estate access |
| Loading/error/not-found states | Consistent page-level headings and recovery navigation; retry where supported | Real errors retained without exposing SQL or internal implementation details |

Use existing route URLs and folder-based routing. Move any route-only UI extracted
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
- Data tables may scroll horizontally within their labelled, keyboard-reachable
  container. Keep names/references/actions visible and readable; do not silently
  omit data because the viewport is narrow. No new sorting/pagination is required.
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
| `/health` | GET | Existing public health response | Secondary status presentation |
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
  current estate changed while another query is loading.
- Request failures, pending submissions and stale-version conflicts: do not hide
  real failures behind a success-looking UI or discard entered information.
- Dialog focus with long contents, bottom-bar overflow dismissal, keyboard-only use,
  zoom, safe-area insets and the on-screen keyboard.
- Both themes; saved preference; initial SSR/hydration before client auth is ready.

## Test-driven implementation phases

- [ ] Agree design/navigation decisions and this scope; establish the combined
      branch/database baseline and run existing checks before any redesign.
- [ ] Write and run failing shell tests for selected navigation, estate context,
      role visibility, bottom app-bar active links/overflow keyboard controls, content
      clearance, skip link and theme selection.
      Implement tokens, shell and the minimum repeated layout pieces.
- [ ] Write and run failing user-flow tests for estate navigation, form feedback,
      required fields, destructive confirmation, empty/error recovery and retained
      input. Restyle estate/location screens, retaining business tests.
- [ ] Write and run failing register/detail tests for filters/back navigation,
      meaningful status labels, date errors and lifecycle actions. Restyle assets,
      assessments/devices and retirement screens after their dependency lands.
- [ ] Write and run failing council tests for owner/delegate/member visibility,
      distinct delivery feedback, pending acceptance and cancellation/removal.
      Restyle the invitation screens after their dependency lands.
- [ ] Restyle local auth/account/home/admin screens with failing tests for any new
      observable behaviour. Preserve existing AuthKit and admin tests.
- [ ] Verify desktop/tablet/mobile and both themes in an actual browser, including
      keyboard, contrast, 200% zoom, long content, scrollable tables and dialogs.
      Do not assert CSS class names or screenshots alone as evidence of correct
      behaviour. Do not claim jsdom proves responsive layout or colour contrast.
- [ ] Run pnpm test, pnpm check-types, web build and pnpm fix. Run targeted tests
      during each loop; retain a final full regression run for branch integration.
- [ ] Update `.docs/frontend/design-system.md`, `.docs/frontend/shell.md` and every
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
  or combining the outstanding PRs into main without their reviews.
- Replacing AuthKit's hosted login/signup with local credential forms.
- New dependencies, fonts, illustration packages or a generic component framework.
- Restyling external WorkOS/Neon/Jira dashboards or redesigning future unbuilt pages.

## Implementation timing — agreed (2026-10-08)

The user wants to start today while both dependency PRs await review. Integrate
both feature branches into feat/ui-redesign, keep UI changes in separate commits,
and keep its eventual PR Draft until the dependency PRs merge. Shared main/dev
are not deployment targets for this work. The agreed design and scope above form
the implementation baseline.

## Agreed design decisions (2026-10-08)

- Dashboard style, desktop sidebar, mobile bottom app bar.
- Default light background with navy/teal accents and a light/dark mode switch.
- Use Estates instead of My estates throughout the redesigned interface.
- Mobile navigation features the main functions currently implemented. Damage
  reporting and other future features join navigation only when delivered.
- Keep additional destinations reachable through More and respect the current
  estate and existing permissions. The initial mapping is a recommendation for
  the current set of features, not a permanent list for future releases.
