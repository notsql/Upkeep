# Estate navigation regroup

**Status:** agreed 2026-11-09, built 2026-11-09 (uncommitted)
**Owner:** Ong Zheng Kai

## Problem

The estate sidebar has grown to five groups and eleven staff items, and some
are grouped by where the code happened to land rather than by what people do:

- **Asset categories** sits under Administration, but both of its settings
  drive the inspection list. The "Fails silently" flag decides *which* kinds
  of equipment get inspection checks (`InspectionListService` →
  `categorySettings.flaggedCategories`). The service interval decides *how
  often* they are due, and also feeds the service-due notification sweep. The
  Inspections page links there twice. Managers cannot tell from the sidebar,
  the page name or its wording ("Fails silently", "Silent-failure flags and
  service intervals") what the page is for.
- **Members** and **Roles** are two sidebar items for one job (who can do
  what in this estate).
- **Documents** has a one-item group ("Records") of its own.
- "Operations" does not say what the three items have in common: they are
  the maintenance flow (fault reports and inspections lead to work orders).

The people using this are estate staff, not engineers, so every label this
change touches is rewritten in everyday English.

This is a web-only change. No API, schema or permission changes.

## Wording

Every visible string this spec changes, old → new. Tests assert the new text.
Strings not listed here stay as they are.

### Sidebar

| Where | Old | New |
| --- | --- | --- |
| Group | Operations | Maintenance |
| Group | Records | *(removed; Documents moves into Assets)* |
| Item | Members, Roles | People & access |
| Item | Asset categories | *(removed; now a tab in Inspections)* |

### Inspections page

| Where | Old | New |
| --- | --- | --- |
| Tabs (sub-nav "Inspection views") | - | **Due checks** · **Check schedules** |
| Link to settings | Set service intervals | Set check schedules |
| Nothing-flagged note | No asset categories are flagged as failing silently, so no checks can be due. | No equipment has regular checks turned on yet, so nothing is due. |
| Nothing-flagged link | Flag categories | Turn on regular checks |

### Check schedules (was Asset categories)

| Where | Old | New |
| --- | --- | --- |
| Page heading | Asset categories | Check schedules |
| Page description | Silent-failure flags and service intervals | Choose which equipment gets regular checks, and how often. |
| Hint (new, one visible line under the description) | - | Turn on regular checks for equipment that can break without anyone noticing, like emergency lights. |
| Summary card | Fails silently | Regular checks on |
| Summary card | Missing service interval | No schedule yet |
| Summary card link | Show these categories | Show these |
| Summary card | Intervals set | Schedule set |
| Filter (sub-nav label) | Filter by service interval | Filter by how often |
| Filter tabs | All · Days · Months · Years · Not set | All · Every few days · Every few months · Every few years · No schedule |
| Column | Category | Equipment type |
| Column | Fails silently (badge "Fails silently" / "No") | Regular checks ("On" / "Off") |
| Column | Service interval | How often (e.g. "Every 3 months", or "No schedule") |
| Column | Last changed ("Default" when never changed) | Last changed ("Never changed") |
| Row action | Edit interval (aria "Edit service interval for <Label>") | Change how often (aria "Change how often <Label> is checked") |
| Row action | Flag (aria "Flag <Label> as failing silently") | Turn on checks (aria "Turn on regular checks for <Label>") |
| Row action | Stop flagging (aria "Stop flagging <Label>") | Turn off checks (aria "Turn off regular checks for <Label>") |
| Confirm title | Flag <Label> as failing silently? | Turn on regular checks for <Label>? |
| Confirm body (on) | *(existing effect text)* | <Label> will show up on Due checks whenever it is due. |
| Confirm button (on) | Flag category | Turn on |
| Confirm title | Stop flagging <Label>? | Turn off regular checks for <Label>? |
| Confirm body (off) | *(existing effect text)* | <Label> will no longer show up on Due checks. |
| Confirm button (off, destructive) | Stop flagging | Turn off |
| Toast | Asset category updated. / Service interval updated. | Saved. |
| Inactive note | This estate is inactive, so its asset categories cannot be changed. | This estate is inactive, so its check schedules can't be changed. |
| Loading | Loading asset categories… | Loading check schedules… |
| Empty (filtered) | No matching categories / No category uses this interval | Nothing here / No equipment is checked this often. |
| Save error (shared dialog) | Unable to save the service interval. Please try again. | Couldn't save. Please try again. |

The shared `ServiceIntervalDialog` is also used on an asset's page. Only its
save-error text changes there; the rest of that card is out of scope.

### People & access

| Where | Old | New |
| --- | --- | --- |
| Page heading on `/council`, `/council/invitations`, `/roles` | Members / Roles | People & access |
| Tabs (sub-nav "People views", replaces "Member views") | Members · Pending invitations | Members · Waiting to join · Roles |

## Behaviour

### Sidebar (staff, non-resident)

- The sidebar shows, in order: an ungrouped **Overview**; **Maintenance**
  with Fault reports, Inspections, Work orders; **Assets** with Assets,
  Locations, Documents; **Administration** with People & access, Notification
  settings, Estate settings.
- No sidebar group is labelled "Operations" or "Records", and there is no
  "Asset categories", "Members" or "Roles" item.
- Every item keeps its current visibility rule (`canOpen*` in
  `lib/estate-destinations.ts`). A group whose items are all hidden is not
  rendered (as today).
- **People & access** is shown when `canOpenMembers` or `canOpenRoles` is
  true. It links to `/council` when `canOpenMembers` is true, otherwise to
  `/roles`.
- **People & access** is marked active on `/council`, `/council/invitations`,
  `/roles`, `/roles/new` and `/roles/$roleId/edit`.
- **Inspections** is marked active on `/inspections`, `/inspections/schedules`
  and `/inspections/schedules/$interval`.
- Resident navigation is unchanged.

### Check schedules

- The screen is served at `/estates/$estateId/inspections/schedules`, and its
  filtered views at `/inspections/schedules/$interval`. The URL slugs stay
  `days` / `months` / `years` / `not-set`; only their labels change. Any other
  `$interval` segment is a 404, as today.
- Apart from the wording above, its table, summary cards, dialogs and
  mutations behave as described in `.docs/frontend/asset-categories.md`.
- `/inspections` and `/inspections/schedules[/$interval]` both show the
  "Inspection views" sub-nav: **Due checks** (exact, `/inspections`) and
  **Check schedules** (`/inspections/schedules`).
- Both are gated by `canOpenInspections`. That is the same predicate
  (`ownerOrDelegate`) that gates Asset categories today, so exactly the same
  people can open it.
- Every in-app link that pointed at `/asset-categories[...]` points at the
  matching `/inspections/schedules[...]`.
- `/asset-categories` redirects to `/inspections/schedules`, and
  `/asset-categories/$interval` redirects to `/inspections/schedules/$interval`,
  so old bookmarks keep working.

### People & access

- `/council`, `/council/invitations` and `/roles` keep their URLs and show
  the heading "People & access" and the "People views" sub-nav.
- The Members and Waiting to join tabs are shown only when `canOpenMembers`
  is true; the Roles tab only when `canOpenRoles` is true.
- Each page keeps its own buttons and filters. Invite member stays on the
  Members views and New role stays on Roles.
- `/roles/new` and `/roles/$roleId/edit` are unchanged (no sub-nav).
- The "first page I can open" fallback in `estate-destinations.ts` is
  unchanged.

## Data

None. No Prisma model changes. The settings stay in `AssetCategoryFlagChange`
and `AssetCategoryIntervalChange`. Only the words on screen change, not what
the flag means.

## API

None. The screens keep calling the same endpoints and query keys. No
`pnpm api:generate`.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| - | - | - | - | - |

## Edge cases

- **Roles-only user.** People & access links to `/roles`, and the sub-nav
  shows only Roles. Nothing links them to `/council`, which would 404.
- **Members-only user.** The sub-nav shows Members and Waiting to join, with
  no Roles tab.
- **Neither.** People & access is hidden. If the other two Administration
  items are also hidden, the group is not rendered.
- **Deep route gate.** `_auth/route.tsx` gates a section root plus one level
  of sub-view (`SUB_VIEW_SECTIONS`). `/inspections/schedules/days` is two
  levels below `inspections`, so the guard must cover it too. A test must show
  that a non-owner, non-delegate gets a 404 there. The `asset-categories`
  entries in `OWNER_GATED` and `SUB_VIEW_SECTIONS` go away with the old route.
- **Redirects respect the gate.** Someone who cannot open Inspections still
  gets a 404 on `/asset-categories`, not a redirect that reveals the page.
- **Inactive estate.** The inactive note and disabled row actions still
  appear on Check schedules.
- **Two sub-navs on one page.** On `/inspections/schedules/*` the "Inspection
  views" and "Filter by how often" sub-navs both render. Each has its own
  accessible label.
- **Server error text.** A failed save shows the server's message in the
  dialog where the server sends one. That text may still say "category" or
  "interval". Changing server messages is out of scope.

## Out of scope

- Merging Fault reports, Inspections and Work orders into one tabbed page.
- Moving Locations under Estate settings.
- Renaming anything in the API, database or URL slugs. "Asset category",
  "silent failure" and "service interval" remain the code's terms.
- Moving `/council` or `/roles` to new URLs.
- Rewording screens this spec does not otherwise touch (e.g. the asset page's
  service-interval card, Work orders). See open question 1.
- Any server, permission or `canOpen*` change.

## Implementation phases

Test-first, in order. Each phase ships alone.

- [x] **1. Sidebar regroup.** `estateGroups` in
      `components/shell/app-navigation.tsx`: group labels, order, Documents
      into Assets.
- [x] **2. People & access.** The shared "People views" sub-nav and heading
      across `/council`, `/council/invitations` and `/roles`, plus the single
      sidebar item with its link target and active matching. Tests for the
      roles-only and members-only users.
- [x] **3. Check schedules.** Move `asset-categories/` to
      `inspections/schedules/` (folder routes). Add the "Inspection views"
      sub-nav, apply the wording table, update inbound links, the
      `Destination` / `page-header` unions and the `_auth` gate, and add the
      `/asset-categories` redirects. Move the existing tests to the new paths.
      Their text changes are only the ones in the wording table.
- [x] **4. Docs.** Rename `.docs/frontend/asset-categories.md` to
      `check-schedules.md` and update it, along with `inspection-list.md`,
      `service-intervals.md`, `estate-roles.md`, `council-invitations.md`,
      any other `.docs/frontend` file naming the old sidebar groups, and
      `.docs/README.md`.

## Open questions

None. Rewording the rest of the app is
[plain-english-wording.md](plain-english-wording.md). The hint is a visible
line, not a "?" tooltip (style rule 10 there). If that spec changes
"asset" to "equipment", the sidebar's Assets group is renamed in its phase,
not here.
