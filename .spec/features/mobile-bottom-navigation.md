# Mobile bottom navigation and compact layout

**Status:** agreed 2026-11-09
**Owner:** Ong Zheng Kai
**Supersedes:** the mobile part of [navigation-rearchitecture.md](navigation-rearchitecture.md)
(sidebar as a Sheet behind a `SidebarTrigger` below 768px).

## Problem

On phones the estate navigation hides behind a hamburger: the desktop sidebar
opens as a full-height Sheet, so every move between sections costs two taps
and covers the page. Pages use desktop spacing on a narrow screen - full-size
cards (24px padding), cards nested in cards, roomy page padding - so little
content fits above the fold. On desktop too, most sections sit in a Card when
the card adds a border and nothing else.

## Behaviour

### Breakpoint

- "Mobile" is the existing sidebar breakpoint (`useIsMobile`, below 768px).
  The desktop sidebar is unchanged.

### Bottom app bar (mobile, estate scope only)

- Shown wherever the desktop sidebar is shown (`hasSidebar`) and the viewport is
  mobile. On mobile the sidebar Sheet and the header's `SidebarTrigger` are
  removed; the header keeps the brand, estate switcher, bell, theme and account.
- Fixed to the bottom of the viewport, padded by `env(safe-area-inset-bottom)`,
  a `nav` labelled "Estate sections". Page content gets matching bottom padding
  so nothing is hidden behind the bar and tab strip.
- One button per desktop sidebar section (Overview counts as its own) - four
  buttons - built
  from the same `useNavigationGroups()` data so permissions never disagree with
  the sidebar:

  | Button | Icon | Tabs (sidebar items, in order) |
  | --- | --- | --- |
  | Overview | LayoutDashboard | (single page - no tabs) |
  | Maintenance | Wrench | Fault reports, Inspections, Work orders |
  | Assets | Layers | Assets, Locations, Documents |
  | Admin | Settings | People & access, Notification settings, Estate settings |

- Overview is the ungrouped top item on desktop; on mobile it is its own
  button, current only on the overview page.
- A section with no permitted items gets no button (same rule as the sidebar).
- Each button: icon above a short label, 44px minimum touch target,
  `aria-current="page"` when any of its items is active.
- Tapping a button navigates to that section's first permitted item.
- Residents (no sections) get one button per resident item - Dashboard,
  Report a fault, My reports - and no tab strip.

### Section tabs (mobile, always visible above the bottom bar)

- Whenever the current page belongs to a section with two or more permitted
  items, a horizontal tab strip sits directly above the bottom bar listing that
  section's items (icon + label). It is always visible - not opened by a tap.
  Single-item sections (Overview) show no strip.
- Tabs are real links styled like shadcn `Tabs` (not client-side tab state);
  the active item is `aria-current="page"`. Nested pages keep their parent item
  selected (the sidebar's existing `active` rule).
- The strip scrolls horizontally when items do not fit (e.g. three long Admin labels on a narrow phone) and
  scrolls the active tab into view; it never wraps.

### Compact mobile layout

- `PageLayout`: mobile padding `px-3 py-4`; desktop unchanged.
- Every `Card` that survives the audit below renders `size="sm"` on mobile
  (16px spacing, smaller title), via a mobile default in the shared card
  wrappers rather than per call site.
- `SummaryCard`: value `text-2xl` on mobile; summary grids show two per row on
  mobile instead of one.
- `PageHeader` / `DetailPageHeader` / `ListPageHeader`: smaller title and
  tighter gap on mobile; header actions become icon-only buttons with
  `aria-label`s on mobile.
- Detail field lists (`DetailCard`'s `dl`): tighter row gap on mobile.

### Card audit (desktop and mobile)

Rule: a Card frames **one distinct thing among siblings** - a dashboard count,
an item in a card list, or a self-contained panel with its own actions beside
other panels. Anything else is page content: `PageSection` (heading + content
on the page), with a `Separator` between consecutive sections where needed. No
card is ever nested in another card.

Every current Card use, with its outcome:

**Keep as Card (sibling items or counts)**

| File | Why |
| --- | --- |
| `components/page/summary-card.tsx` + `inspections/schedules/.../category-summary-cards.tsx` | dashboard counts |
| `routes/-components/home-page/resident-home/count-card.tsx`, `components/states/home-pending.tsx` | dashboard counts / their skeleton |
| `components/reports/report-card.tsx` | item in a report list |
| `estates/-components/estate-list-page/estate-card.tsx` | item in the estate grid |
| `assets/-components/asset-register-page/asset-register-cards.tsx` | item in the asset grid |
| `assets/-components/inspection-asset-list.tsx` (per asset) | item in a list |
| `admin/users/.../admin-users-member-cards.tsx` | mobile member list items |
| `assets/$assetId/.../anomaly-alerts-section.tsx` (per alert, already `sm`) | item in a list |
| `estates/$estateId/-components/estate-details-page/budget-forecast-card.tsx`, `list-card.tsx` | side-by-side overview panels |
| `assets/$assetId/.../asset-overview/asset-forecast-card.tsx` | side-by-side overview panel |
| `estates/-components/estate-editor-page/estate-danger-zone.tsx` | destructive panel, set apart on purpose |
| `routes/-components/home-page/home-feature-cards.tsx` | three sibling feature tiles (signed-out home) |

**Drop the Card -> `PageSection` / plain content**

| File | Why |
| --- | --- |
| `work-orders/$workOrderId/.../work-order-detail-summary.tsx` | the page's main details - plain `dl` |
| `work-orders/$workOrderId/.../work-order-progress.tsx` | page section |
| `work-orders/$workOrderId/.../status-history.tsx` | only a list |
| `work-orders/$workOrderId/.../outcome-corrections.tsx` | only a list |
| `work-orders/$workOrderId/.../work-order-documents.tsx` | only a table |
| `work-orders/new/.../work-order-inspection-context.tsx` | `DetailCard` inside a form card - nesting |
| `notification-settings/.../notification-settings-form.tsx` | only thing on the page |
| `council/.../access-controls.tsx` | only a list |
| `council/.../estate-members/estate-members.tsx` | only a list/table |
| `-components/locations-section/locations-tree-card.tsx` | only a tree |
| `readings/imports/-components/reading-imports-page.tsx` (upload form + "Batch history") | page sections |
| `readings/imports/-components/import-history.tsx` (mobile per-row cards) | list rows with dividers, not cards |
| `readings/imports/$batchId/.../import-batch-results.tsx`, `import-batch-metadata.tsx` | page sections |
| `readings/imports/$batchId/.../import-row-results.tsx` (mobile per-row cards) | list rows with dividers |
| `assets/$assetId/inspections/$inspectionId/.../inspection-detail.tsx` | `DetailCard` in a Card - nesting |
| `assets/$assetId/-components/inspection-asset-page.tsx` | `DetailCard` in a Card - nesting |
| `assets/$assetId/_details/history/.../history-date-filter.tsx` | a filter bar, not a section |
| `assets/$assetId/_details/history/.../history-timeline-entry.tsx` | timeline rows, not cards |
| `assets/$assetId/.../asset-documents-content.tsx` | only a table |
| `assets/$assetId/.../asset-retirement-panel.tsx` | only a list |
| `assets/$assetId/.../asset-condition-section.tsx`, `asset-maintenance-section.tsx`, `asset-details-tab.tsx`, `inspection-history-page.tsx` | page sections on a tab |
| `assets/$assetId/.../asset-service-interval-card.tsx` | page section |
| `assets/$assetId/.../anomaly-alerts-section.tsx` (outer `SectionCard`) | wrapper around a card list - nesting |
| `assets/-components/history-asset-list.tsx` | only a table |
| `assets/devices/.../metric-policy-settings.tsx` | only a list/table |
| `reports/$reportId/.../duplicate-section.tsx` (3 cards) | page sections |
| `admin/-components/member-estates/member-estates.tsx` | only a list |
| `admin/users/.../admin-users-header.tsx` (role stat) | header detail, not a panel |
| `account/index.tsx` | only thing on the page - plain `dl` |
| `routes/-components/home-page/system-status.tsx`, `home-sign-in-card.tsx` | single page block |

`DetailCard` becomes `DetailList` (the same `dl`, no card) since every use is
either the page's main content or nested. `SectionCard` stays available for the
"self-contained panel" case but no longer wraps tables/lists. Files not listed
that gain a Card later follow the rule above.

## Data

None.

## API

None.

## Edge cases

- A section with exactly one permitted item after filtering (e.g. Crew whose
  Assets is only Assets): single-item - no tab strip.
- Only one section visible: the bar still shows one button.
- A page that belongs to no sidebar item (e.g. `/estates/$id/readings`): no
  button is current and no strip shows.
- Resizing across 768px swaps sidebar and bottom bar without losing route state.
- Sticky page elements (filter bars, form actions) sit above the bar and strip,
  not under them.

## Out of scope

- New destinations or permission changes - the bar re-presents the sidebar.
- Bottom navigation outside estate scope (`/estates`, `/account`, `/admin/**`).
- Hiding the bar while the on-screen keyboard is open.
- Swipe gestures between tabs.
- Table-to-list redesigns beyond the card audit above.
