# Navigation re-architecture

**Status:** implemented 2026-11-04 (agreed 2026-11-04; see "Deviations from build")
**Owner:** Ong Zheng Kai
**Supersedes:** the navigation parts of `ui-redesign.md` ("Application shell and
navigation", "Contextual estate switching"), `mobile-estate-navigation-and-lists.md`
(mobile section menu), and the signed-in Home part of
`portfolio-home-and-estate-directory.md` (portfolio dashboard dropped).

## Problem

Signed-in users cannot tell where they are or find every estate feature:

- The estate sidebar (`components/app-navigation.tsx`) mixes a "Workspace" group
  (Home, Estates, Settings, Admin users, scoped "<estate> roles/invitations",
  cross-estate Work orders / Documents / Respond to faults choosers, resident
  links) with the estate's own sections.
- The estate switcher (`NavigationEstateSwitcher`) sits mid-sidebar. On mobile it
  is duplicated: the sidebar Sheet plus `EstateNavigation` (switcher +
  `components/estate-section-menu.tsx`) rendered at the top of `#main-content`.
- The overview (`estate-details-page.tsx`) has a 10-control "Estate actions" row.
  Devices, Asset categories, Inspections, Device monitoring (`/sensors`), Edit
  estate and Failure risk are reachable **only** from that row.
- Deep pages show both a `BackLink` and breadcrumbs. `sensors-page`,
  `asset-categories-page`, `inspections-page` and `estate-devices-page` label a
  crumb "Estate" instead of the estate name. Resident `/reports` and
  `/reports/new` pages have no `PageHeader`; `inspections-page.tsx` renders a raw
  `<main>` instead of `PageLayout`.
- Home (`/`, `WorkspaceHome`) and Estates (`/estates`) are two landings that
  overlap: both show estates and pending invitations.

## Behaviour

### Header (every signed-in page)

- `components/header.tsx` stays sticky and is the same on mobile and desktop.
  Left to right: `SidebarTrigger` (only when the page has a sidebar), the UpKeep
  brand, a "/" separator, then the **estate switcher**. Right: `ThemeToggle`,
  account menu.
- The switcher is `components/estates/estate-feature-switcher.tsx` restyled for
  the header (ghost button, not full-width outline). Trigger shows the current
  estate name and role label (`estateRoleLabel`). Menu: every estate in
  `access.estates` with its role and a check on the current one, separator,
  "All estates" → `/estates`, "Create estate" → `/estates/new` only when
  `canCreateEstate`. (Already the menu's content today.)
- Outside an estate (`/estates`, `/estates/new`, `/account`, `/admin/users`,
  `/invitations`) the trigger reads "Select estate".
- The current estate comes from the URL only: `/estates/$estateId/...`, or on
  `/reports*` the `estateId` search param, else the sole resident estate (the
  existing `useNavigationEstate` rule). No storage.
- Choosing an estate keeps the existing `estateDestination` mapping (stay on the
  same feature when the target estate allows it, else overview, else the first
  permitted section; residents go to `/reports` or `/reports/new`).
- The three thin wrappers are deleted and callers use `EstateFeatureSwitcher`
  directly: `estates/estate-context-switcher.tsx`,
  `estates/work-order-estate-switcher.tsx`, `reports/report-estate-switcher.tsx`.
  The `feature` prop is derived once in the header from the pathname
  (`reports` / `work-orders` / `documents` / `readings` / `report-creation` /
  `resident` / `management`).
- Account menu (`components/auth-button.tsx`): email label, "Account settings" →
  `/account` (renamed from "Settings"), "Admin users" → `/admin/users` only when
  `canAccessPlatformAdmin`, "Sign out" → `/logout`. No other links: the `menu`
  prop, `WorkspaceHeader` and `WorkspaceMenuItems` are removed.

### Sidebar (estate scope only)

- Shown on `/estates/$estateId/**` (not `new`) and, for residents, on `/reports**`.
  Not shown on `/estates`, `/estates/new`, `/account`, `/admin/**`,
  `/invitations`.
- No "Workspace" group, no switcher, no scoped/cross-estate entries, no
  `EstateFeatureChooser`. `SidebarHeader` brand link is removed (brand is in the
  header). Footer tagline unchanged.
- Groups and items, each filtered by the capability below. Where the overview
  button and the current sidebar rule differ, the stricter rule is used. A group
  with no visible items is not rendered.

| Group | Item | Route | Shown when |
| --- | --- | --- | --- |
| (none) | Overview | `/estates/$estateId` | `canViewEstateDetails ?? canViewManagement` |
| Operations | Work orders | `/work-orders` | `canViewWorkOrders` |
| Operations | Fault reports | `/reports` | `canViewFaultReports` |
| Operations | Inspections | `/inspections` | `owned \|\| canManageInvitationPermissions` |
| Assets | Assets | `/assets` | `canViewAssets \|\| canViewInspectionResults` |
| Assets | Devices | `/devices` | `owned \|\| canManageInvitationPermissions` |
| Assets | Readings | `/readings` | `canViewReadings` |
| Assets | Device monitoring | `/sensors` | `canViewEstateSensors(...)` (moved out of `estate-details-page.tsx`) |
| Assets | Failure risk | `/failure-risk` | `owned` |
| Records | Documents | `/documents` | `canViewDocuments` |
| Administration | Members | `/council` | `canViewEstateInvitations \|\| canInviteMembers \|\| canManageInvitationPermissions` |
| Administration | Roles | `/roles` | `canViewEstateRoles` |
| Administration | Asset categories | `/asset-categories` | `owned \|\| canManageInvitationPermissions` |
| Administration | Estate settings | `/edit` | `owned \|\| canManageEstate` |

  `owned` comes from `useEstate(estateId)` (`EstateResponse.owned`), which the
  sidebar already loads when `canViewManagement`. Until it resolves, owner-only
  items are hidden (no flicker into view then out).
- **One predicate per destination, shared with the route guard.** A new module
  `apps/web/src/lib/estate-destinations.ts` exports one pure function per row of
  the table above, e.g. `canOpenDevices(permission, estate)`,
  `canOpenAssetCategories`, `canOpenInspections`, `canOpenSensors`
  (absorbs `canViewEstateSensors` from `estate-details-page.tsx`),
  `canOpenFailureRisk`, `canOpenEstateSettings`, `canOpenAssets`, plus the
  rest of the table. Inputs are the `EstateAccessResponse`, `owned` and
  `canAccessPlatformAdmin`. The sidebar and `_auth/route.tsx` both import from it;
  neither restates a rule. (Checked: `EstateAccessResponse` has no owner flag,
  so `owned` must come from `EstateResponse`.)
- **Guards tightened** (`_auth/route.tsx`): `/devices`, `/asset-categories`,
  `/inspections`, `/sensors`, `/failure-risk`, `/edit` and `/assets` (list) 404
  unless the same predicate the sidebar uses is true. `guardEstatePath` no longer
  falls back to `canViewManagement` for them. The guard runs in `beforeLoad`
  with only the access context, so `owned` must come from there: if
  `EstateAccessResponse` has no owner flag, the guard fetches the estate via
  `GET /estates/{id}` (`ensureQueryData` on the existing `useEstate` key) before
  evaluating owner-based predicates (agreed: cached fetch, no server change). Asset children
  (`/assets/$assetId/**`) keep their current inspection-context rules
  (`guardInspectionContext`); only the list route uses `canOpenAssets`
  (`canViewAssets || canViewInspectionResults`). That way Assets is reachable
  for inspection-only users who reach it from the sidebar, which resolves the
  earlier Assets-rule question.

### Resident experience

Residents never see estate management: no estate sidebar, and estate routes
still redirect a `RESIDENT` membership to the resident area (existing
`guardEstatePath` rule).

- Header: same header; the switcher lists only `access.residentEstates` (choices
  behave as today: inactive ones disabled with "Reporting unavailable"); account
  menu unchanged.
- Sidebar (one unlabelled group, from `components/estates/resident-navigation.tsx`):
  "Dashboard" → `/` (hidden for mixed resident + staff accounts, whose `/`
  follows the staff redirect), "Report a fault" → `/reports/new?estateId=`,
  "My reports" → `/reports?estateId=`. Shown on `/` (resident-only accounts),
  `/reports`, `/reports/new`, `/reports/$reportId`.
- **Routing: no new route.** The dashboard renders at the existing `/` route for
  resident-only accounts (`hasResidentMembership && !canEnterWorkspace`), which
  today redirect to `/reports/new`. That redirect is removed; `home-page.tsx`
  renders `ResidentDashboard` (new, `routes/-components/resident-dashboard.tsx`)
  in that branch. `/reports` keeps the list and `/reports/new` the form. This
  reuses `/` and leaves the existing report URLs alone. A route at `/reports`
  would have meant moving the list to a new URL.
- Dashboard content (a `PageLayout` + `PageHeader` titled "Dashboard", action
  "Report a fault"):
  - three summary `Card`s, Open / In progress / Resolved, read from the new
    server-side `counts` on `GET /resident/reports` (see API), via the existing
    `useReportList(undefined, estateId)` (key
    `[userId, "reports", "list", estateId, undefined]`). Counts cover every
    report the resident can see (all pages), scoped by `estateId` when given;
  - "Recent reports": the first 5 items as `ReportCard`s, then a "View all" link
    → `/reports`;
  - empty state: "You haven't reported any faults yet." plus "Report a fault".
- No new endpoint; one response field is added (see API).
- Active state: the item whose route prefixes the pathname is active
  (`aria-current="page"`); nested pages keep their section active. Exact match
  for Overview.
- Mobile (<768px): the same sidebar opens as the existing `Sheet` from the
  header `SidebarTrigger`, closing on navigation. `EstateNavigation` and
  `components/estate-section-menu.tsx` are deleted.

### `/` and `/estates`

- `/estates` (`estate-list-page.tsx`) is the single "All estates" landing:
  directory plus pending invitations (already both there). Title stays
  "Estates"; no other content change.
- Signed-in `/` (`routes/index.tsx` `beforeLoad`), in order:
  - resident-only account → no redirect; renders the resident dashboard;
  - existing report-only → `/estates/$id/reports` and roles/invitations-only →
    `/roles` or `/council` redirects, unchanged;
  - `access.estates.length === 1` (any membership counts) → that estate's
    `estateDestination(...)`;
  - otherwise (0 or 2+) → `/estates`.
- Signed-out `/` still renders the public `HomePage`.
- **Portfolio dashboard dropped.** Delete `routes/-components/workspace-home.tsx`,
  `routes/-components/asset-condition-distribution.tsx`,
  `tests/routes/-components/workspace-home.test.tsx`, and the web code only it
  used: `src/lib/dashboard.ts` (`useDashboardSummary`, `dashboardQueryKey`), the
  `dashboardQueryKey` invalidations in `lib/assets.ts`, `lib/assessments.ts`,
  `lib/estates.ts` and `estate-details-page.tsx`, and
  `tests/lib/dashboard-updates.test.tsx`. Server `GET /dashboard` is left alone;
  it is now unused by web (follow-up, out of scope).

### Estate overview and Estate settings

- `estate-details-page.tsx`: `PageHeader` (estate name, `LifecycleStatusBadge`,
  `description` = estate description or omitted), the inactive alert, the
  details `DetailCard`, then `children` (Locations). Removed: `EstateActions`,
  the Assets card (View assets / Register asset), the "Back to estates" link,
  breadcrumbs, the deactivate mutation and dialog.
- `/estates/$estateId/edit` is titled "Estate settings". It renders the existing
  `estate-editor-page.tsx` edit form, then (owner only, estate active) a
  "Danger zone" `Card` with "Deactivate estate", which opens
  `DeactivateEstateDialog`. The deactivate mutation (cache update, toast,
  invalidations) moves here unchanged.
- "Register asset" remains reachable from the Assets list header action
  (`asset-register-page.tsx` already has it).

### Page header convention

- `components/back-link.tsx` and `tests/components/back-link.test.tsx` are
  deleted; no page renders a "Back to …" link.
- Top-level sections (one segment under the estate: work-orders, reports,
  inspections, assets, devices, readings, sensors, failure-risk, documents,
  council, roles, asset-categories, edit) and the overview render **no
  breadcrumbs**.
- Pages two or more levels deep render breadcrumbs that start at the section and
  use loaded names, never "Estate": e.g. `Assets › Pump A › Edit`,
  `Work orders › WO-12`, `Fault reports › <report title>`,
  `Readings › Record reading`. During loading the record crumb shows a stable
  fallback ("Asset", "Work order").
- Roles is a top-level section (no breadcrumbs). The overview keeps the
  "Shared with you…" note.
- Outside an estate, `/estates/new` shows `Estates › Create estate` (header
  switcher reads "Select estate");
  `/account`, `/admin/users`, `/estates` show none.
- The page's primary action goes in `PageHeader` `actions` (right-aligned).
- `/reports`, `/reports/new` and `inspections-page.tsx` use `PageLayout` +
  `PageHeader`.
- `PageHeader`'s `Breadcrumb.to` union gains the section routes it now needs and
  drops `"/"`.

## Information architecture — before and after

All estate routes are `/estates/$estateId/...`; "row" = overview action row.

| Route | Reached from today | Reached from after |
| --- | --- | --- |
| `/` (signed in) | Brand, sidebar Home, account menu Home | Brand only; redirects |
| `/estates` | Sidebar Estates, account menu, switcher "All estates", BackLink | Switcher "All estates", `/` redirect |
| `/estates/new` | Estates page, switcher | Estates page, switcher "Create estate" |
| `/account` | Sidebar Settings, account menu Settings | Account menu "Account settings" |
| `/admin/users` | Sidebar / account menu Admin users | Account menu "Admin users" |
| `/invitations` | Invitation email link | Unchanged |
| overview | Sidebar Overview, switcher, Estates cards | Sidebar Overview, switcher, Estates cards, `/` redirect |
| `/work-orders` (+ `/new`, `/$id`) | Sidebar, row, Workspace chooser | Sidebar Operations, switcher |
| `/reports` (+ `/$id`) | Sidebar, Workspace "Respond to faults" | Sidebar Operations, switcher |
| `/inspections` | **Row only** | Sidebar Operations |
| `/assets` (+ `/new`, `/$id`, `/edit`, `/readings`, `/devices/**`, `/inspections/**`) | Sidebar, overview Assets card | Sidebar Assets; children from the Assets pages |
| `/devices` | **Row only** | Sidebar Assets |
| `/readings` (+ `/new`) | Sidebar | Sidebar Assets |
| `/sensors` | **Row only** | Sidebar Assets "Device monitoring" |
| `/failure-risk` | **Row only** | Sidebar Assets |
| `/documents` | Sidebar, Workspace chooser | Sidebar Records, switcher |
| `/council` | Sidebar "Estate members", row, scoped Workspace entry | Sidebar Administration "Members" |
| `/roles` | Sidebar, row, scoped Workspace entry | Sidebar Administration |
| `/asset-categories` | **Row only** | Sidebar Administration |
| `/edit` | **Row only** ("Edit estate") | Sidebar Administration "Estate settings" |
| Deactivate estate | Row button | Estate settings → Danger zone |
| `/` (resident-only) | Redirects to `/reports/new` | Resident dashboard; sidebar "Dashboard" |
| `/reports` (resident), `/reports/new`, `/reports/$id` | Workspace resident links, account menu | Resident sidebar, dashboard links, switcher |

## Wireframes

Desktop, inside an estate:

```
+----------------------------------------------------------------------------+
| [=] UpKeep / [Bishan Court  Manager v]                       [*] [(o)]     |
+------------------+---------------------------------------------------------+
| Overview         |  Assets > Pump A > Edit                                 |
|                  |  Edit asset                                  [Save]     |
| OPERATIONS       |  -----------------------------------------------------  |
|  Work orders     |                                                         |
|  Fault reports   |                                                         |
|  Inspections     |                                                         |
| ASSETS           |                                                         |
| >Assets          |                                                         |
|  Devices         |                                                         |
|  Readings        |                                                         |
|  Device monitor. |                                                         |
|  Failure risk    |                                                         |
| RECORDS          |                                                         |
|  Documents       |                                                         |
| ADMINISTRATION   |                                                         |
|  Members         |                                                         |
|  Roles           |                                                         |
|  Asset categories|                                                         |
|  Estate settings |                                                         |
| Your estates...  |                                                         |
+------------------+---------------------------------------------------------+
```

Mobile, sheet open (header identical; outside an estate the switcher reads
"Select estate" and there is no `[=]`):

```
+--------------------------------+
| [=] UpKeep / [Bishan Co.. v] [*][(o)] |
+-------------------+------------+
| Overview          |////////////|
| OPERATIONS        |////////////|
|  Work orders      |////////////|
|  Fault reports    |//  page  //|
|  Inspections      |// dimmed //|
| ASSETS            |////////////|
| >Assets           |////////////|
|  ...              |////////////|
| ADMINISTRATION    |////////////|
|  ...              |////////////|
+-------------------+------------+
```

## Implementation phases

Each phase ships alone with `pnpm check-types` and `pnpm test` green. Per
`.spec/testing.md`: write the failing test under `apps/web/tests/` mirroring
`src/`, run it, see it fail, then implement. Query by role and accessible name.

### P1 — Shell

Files: `components/header.tsx`, `components/app-shell.tsx`,
`components/app-navigation.tsx`, `components/auth-button.tsx`,
`components/estates/estate-feature-switcher.tsx`, `components/estates/resident-navigation.tsx`;
delete `components/estate-section-menu.tsx`,
`components/estates/estate-context-switcher.tsx`,
`components/estates/work-order-estate-switcher.tsx`,
`components/reports/report-estate-switcher.tsx`, and
`components/estates/estate-feature-chooser.tsx` (only consumers are the removed
Workspace entries). Add `lib/estate-destinations.ts` (moves
`canViewEstateSensors` out of `estate-details-page.tsx`) and tighten
`routes/_auth/route.tsx`.

Tests first:
- `tests/lib/estate-destinations.test.ts` (new): each predicate's truth table
  (owner, `canManageInvitationPermissions`, `canManageEstate`, sensor roles,
  inspection-only assets).
- `tests/routes/_auth/route.test.ts` (new, or extend the existing guard test if
  one exists): `/devices`, `/asset-categories`, `/inspections`, `/sensors`,
  `/failure-risk`, `/edit`, `/assets` 404 for a `canViewManagement`-only
  non-owner, and pass when the matching predicate is true.
- `tests/components/header.test.tsx`: switcher shows estate name + role inside an
  estate, "Select estate" outside; menu has "All estates", and "Create estate"
  only with `canCreateEstate`.
- `tests/components/auth-button.test.tsx` (new): "Account settings", "Admin users"
  only for platform admins, "Sign out"; no other links.
- `tests/components/app-navigation.test.tsx`: no "Workspace" group or switcher;
  each item in the table shown/hidden per capability; empty groups absent;
  Inspections/Devices/Asset categories need `owned || canManageInvitationPermissions`;
  resident sidebar ("Dashboard", "Report a fault", "My reports") on `/reports`;
  resident switcher lists only resident estates.
- `tests/components/app-shell.test.tsx`: sidebar on estate routes and resident
  `/reports`, not on `/estates`, `/account`; no "Estate navigation" landmark on mobile.

Likely to break: `tests/components/app-navigation.test.tsx`,
`tests/components/app-shell.test.tsx`, `tests/components/header.test.tsx`,
`tests/components/document-navigation.test.tsx`,
`tests/routes/_auth/estates/work-order-list.test.tsx`,
`tests/routes/_auth/estates/$estateId/reports/index.test.tsx` (switcher/chooser
assertions), any test asserting "Settings" in the account menu, and any page test that opens
`/devices`, `/sensors`, etc. as a `canViewManagement`-only fixture
(`.../sensors/-components/sensors-page.test.tsx`,
`.../failure-risk/-components/failure-risk-page.test.tsx`,
`tests/routes/_auth/estates/inspection-results.test.tsx`).

### P2 — `/` redirect, Estates landing, resident dashboard

Files: `routes/index.tsx`, `routes/-components/home-page.tsx` (drop the
`WorkspaceHome` branch; resident-only branch renders `ResidentDashboard`), new
`routes/-components/resident-dashboard.tsx`; delete the portfolio dashboard files
listed under "`/` and `/estates`" and its `dashboardQueryKey` invalidations.

Tests first:
- `tests/routes/index.test.ts`: exactly one estate membership → its destination;
  zero or 2+ → `/estates`; resident-only → no redirect; report-only and
  roles-only redirects unchanged; signed out renders `HomePage`.
- Server, JUnit first: extend
  `apps/server/src/test/java/com/proj/server/resident/ResidentReportServiceTests.java`
  (and the controller test if present) so `GET /resident/reports` returns
  `counts` = `{open, inProgress, resolved}` over all of the resident's reports
  (not just the page), `ASSIGNED` + `IN_PROGRESS` → `inProgress`, `CLOSED` →
  `resolved`, filtered by `estateId`. Implement in
  `ResidentReportService` / `ResidentReportController` (`IssueReportPageResponse`
  gains the field), then `pnpm api:generate` and `pnpm check-types`.
- `tests/routes/-components/resident-dashboard.test.tsx` (new): cards show the
  mocked response's `counts`; at most 5 recent reports; "View all" and "Report a fault" links;
  empty state.

Likely to break: `tests/routes/index.test.ts`, `tests/routes/index.test.tsx`,
`tests/routes/-components/home-page.test.tsx` (resident branch),
`tests/routes/-components/workspace-home.test.tsx` and
`tests/lib/dashboard-updates.test.tsx` (deleted with their subject),
`tests/routes/_auth/estates/-components/estate-dashboard-updates.test.tsx`
(asserts dashboard invalidation; delete or trim to the estate-list part).

### P3 — Overview and Estate settings

Files: `routes/_auth/estates/$estateId/-components/estate-details-page.tsx`,
`routes/_auth/estates/$estateId/edit/index.tsx`,
`routes/_auth/estates/-components/estate-editor-page.tsx`,
`routes/_auth/estates/$estateId/-components/deactivate-estate-dialog.tsx` (reused as is).

Tests first:
- `tests/routes/_auth/estates/$estateId/-components/estate-details-page.test.tsx`:
  no "Estate actions" group, no Assets card, no "Back to estates"; name, status
  and details render.
- `tests/routes/_auth/estates/-components/estate-editor-page.test.tsx`: edit mode
  titled "Estate settings"; "Danger zone" with "Deactivate estate" for owners of
  an active estate only; confirming deactivates and toasts.

Likely to break: the two above,
`tests/routes/_auth/estates/$estateId/-components/deactivate-estate-dialog.test.tsx`
(if it drives the overview), `estate-dashboard-updates.test.tsx`,
`tests/routes/_auth/estates/$estateId/roles/index.test.tsx`,
`.../sensors/-components/sensors-page.test.tsx`,
`.../failure-risk/-components/failure-risk-page.test.tsx` (they reach their page
through overview buttons).

### P4 — Page header consistency

Remove `BackLink`, set breadcrumbs per the convention, move the primary action
into `actions`. Under `routes/_auth/`:

- Top-level (drop breadcrumbs): `estates/$estateId/work-orders/-components/work-order-list-page.tsx`,
  `estates/$estateId/reports/index.tsx`,
  `estates/$estateId/inspections/-components/inspections-page.tsx` (also `<main>` → `PageLayout`),
  `estates/$estateId/assets/-components/asset-register-page.tsx`,
  `estates/$estateId/assets/-components/inspection-asset-list.tsx`,
  `estates/$estateId/devices/-components/estate-devices-page.tsx`,
  `estates/$estateId/readings/-components/estate-readings-page.tsx`,
  `estates/$estateId/sensors/-components/sensors-page.tsx`,
  `estates/$estateId/failure-risk/-components/failure-risk-page.tsx`,
  `estates/$estateId/documents/-components/documents-page.tsx`,
  `estates/$estateId/council/-components/council-page.tsx`,
  `estates/$estateId/roles/-components/estate-roles-page.tsx`,
  `estates/$estateId/asset-categories/-components/asset-categories-page.tsx`.
- Deep (section-first breadcrumbs, real names):
  `estates/$estateId/assets/-components/asset-editor-page.tsx` (new + edit),
  `estates/$estateId/assets/$assetId/-components/asset-details-page.tsx`,
  `estates/$estateId/assets/$assetId/-components/inspection-asset-page.tsx`,
  `estates/$estateId/assets/$assetId/readings/-components/readings-page.tsx`,
  `estates/$estateId/assets/$assetId/devices/new/-components/new-device-page.tsx`,
  `estates/$estateId/assets/$assetId/devices/$deviceId/replace/-components/replace-device-page.tsx`,
  `estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form.tsx`,
  `estates/$estateId/assets/$assetId/inspections/$inspectionId/-components/inspection-detail.tsx`,
  `estates/$estateId/work-orders/new/-components/work-order-form.tsx`,
  `estates/$estateId/work-orders/new/-components/work-order-inspection-context.tsx` (BackLink),
  `estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page.tsx`,
  `estates/$estateId/reports/$reportId/index.tsx`,
  `estates/$estateId/readings/new/-components/manual-reading-form.tsx`.
- Outside an estate: `estates/-components/estate-editor-page.tsx` (create:
  `Estates › Create estate`), `account/index.tsx`,
  `admin/users/-components/admin-users-page.tsx` (drop breadcrumbs).
- Resident: `reports/-components/my-reports-page.tsx`,
  `reports/new/-components/new-report-page.tsx` (add `PageLayout` + `PageHeader`),
  `reports/$reportId/index.tsx` (`My reports › <title>`).
- Shared: `components/page-header.tsx` (route union), delete `components/back-link.tsx`.

Tests first: `tests/components/page-header.test.tsx` for the new route union, and
one assertion per deep page above that its breadcrumbs start at the section and
contain no "Estate" crumb.

Likely to break (assert breadcrumbs or "Back to"): `tests/components/back-link.test.tsx`
(deleted), `tests/components/page-header.test.tsx`,
`.../assets/$assetId/-components/asset-details-page.test.tsx`,
`.../assets/-components/asset-editor-page.test.tsx`,
`.../assets/-components/asset-register-page.test.tsx`,
`.../$estateId/reports/index.test.tsx`,
`tests/routes/_auth/estates/-components/estate-editor-page.test.tsx`,
`tests/routes/_auth/estates/inspection-results.test.tsx`,
`tests/routes/_auth/estates/work-order-list.test.tsx`.

### P5 — Documentation

- `.docs/frontend/shell.md`: rewrite "Shell and navigation" and "Estate section
  navigation on mobile"; update "Resident reporting context".
- `.docs/frontend/design-system.md`: "Shell and responsive navigation" and the
  page-header/breadcrumb convention in "Pages, actions and forms".
- `.docs/frontend/estates.md`: overview content, Estate settings + Danger zone,
  `/` redirect.
- `.docs/frontend/dashboard.md`: delete (portfolio Home is gone); new
  `.docs/frontend/resident-dashboard.md` for the resident dashboard, or a section
  in `.docs/frontend/resident-reports.md`; `.docs/README.md` index updated;
  `.docs/api/dashboard.md` notes that the web app no longer calls `GET /dashboard`; `.docs/api/resident-reports.md` adds `counts`.
- `.spec/features/ui-redesign.md`: mark "Application shell and navigation —
  desktop sidebar / mobile bottom app bar" (including the stale bottom-bar /
  "Home / Estates / More" text, which no longer matches the code) and
  "Contextual estate switching" as superseded by this spec.
  `mobile-estate-navigation-and-lists.md` (section menu) likewise, and mark
  "Home: understand and prioritise" in `portfolio-home-and-estate-directory.md`
  superseded (portfolio dashboard dropped).

## Data

None. No Prisma changes.

## API

One change, in P2. Otherwise uses existing `GET /access/context`
(`[userId, "app-access"]`) and `GET /estates/{id}` (now also fetched, cached, by
the owner-only route guards); `POST /estates/{id}/deactivate` moves call site only.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/resident/reports` | unchanged (`cursor?`, `estateId?`) | `IssueReportPageResponse` + `counts: { open: integer; inProgress: integer; resolved: integer }` (required) | Resident JWT, unchanged |

Additive, so the running web app is unaffected (expand-only). Regenerate
`packages/api/openapi.json` and `packages/api/src/schema.ts` with
`pnpm api:generate`. Docs: `.docs/api/resident-reports.md` documents `counts`
and the status mapping; `.docs/api/dashboard.md` notes `GET /dashboard` is
unused by web.

## Edge cases

- Access context loading or errored: header switcher shows "Select estate"
  disabled; sidebar renders no items (as today).
- Estate in URL that the user cannot access: route guard 404s as today; the
  switcher shows "Select estate".
- Estate whose only capability is roles or invitations: sidebar shows only
  Administration › Roles/Members; no Overview.
- Owner-only items while `useEstate` is pending: hidden until `owned` is known.
- Inactive estate: Danger zone hidden (nothing to deactivate); sidebar unchanged.
- Mixed resident + staff account on `/reports`: resident sidebar for the selected
  resident estate; switcher lists all estates.
- Single membership with no navigable destination: `estateDestination` returns
  `/estates`, so `/` lands on `/estates`.
- Resident with more reports than one page: counts still cover all of them (server-side).
- Guard for owner-only routes when `GET /estates/{id}` fails: 404 (fail closed).

## Out of scope

- New endpoints, new data or metrics on the overview, theme or visual changes.
- Route URL changes, except `/` redirect behaviour.
- Server `GET /dashboard` (left in place; unused by web after P2, follow-up).
- New resident endpoints (only a field is added).
- Remembering the last estate.

## Deviations from build

- **Resident counts type.** `GET /resident/reports` returns a new
  `ResidentReportPageResponse` record (`items`, `nextCursor`, `counts:
  ReportCounts`) instead of adding `counts` to the shared
  `IssueReportPageResponse`, so estate report pages are unchanged.
- **"View inspection" link kept.** The two dead-end work-order-from-inspection
  screens (inspection already has a work order; inspection did not fail) keep an
  outline "View inspection" link to the source inspection in place of the
  removed `BackLink`, since they render no `PageHeader` to carry breadcrumbs.
- **Report detail heading.** `/reports/$reportId` keeps the heading "Report
  details"; only the breadcrumb (`My reports › <title>`) shows the title.
- `PageHeader` breadcrumbs also gained an optional `search` (`{ estateId? }`)
  for resident crumbs.
- The structural choice of shared destination predicates is recorded in
  `.spec/decisions/0043-estate-destinations-share-sidebar-and-guard-rules.md`.

## Open questions

None. All resolved 2026-11-04.
