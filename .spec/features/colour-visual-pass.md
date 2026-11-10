# Colour and visual pass

**Status:** draft
**Owner:** Ong Zheng Kai

## Problem

The web UI looks very plain. Every surface token in
`packages/ui/src/styles/globals.css` (background, card, muted, accent,
border, input, ring, sidebar) has zero chroma. The only colour is the blue
`--primary`. Status colours are scattered across raw Tailwind palette classes
(`emerald-*` in `apps/web/src/lib/status-tone.ts`, `blue-*`/`emerald-*` in
`inspections-page/status-badge.tsx`, amber in `components/page/summary-card.tsx`),
so the same meaning gets different colours on different screens. Several
statuses (report status, report urgency below URGENT, asset condition) get no
colour at all. That makes things harder to scan: a manager can't pick out what
needs attention by colour.

Direction agreed with the user: **tinted blue**. Keep the brand blue primary,
keep the neutral surfaces near-neutral (white ground, barely cool greys), add a three-step blue brand scale (sky, brand blue, indigo) for
highlights and gradients, and add semantic status tokens. No teal anywhere. Scope is a **full visual pass** across every screen.

This supersedes the line in `.docs/frontend/design-system.md` that says "no
custom colour tokens". The new tokens live in `packages/ui/src/styles/globals.css`
beside the preset's own tokens, never in `apps/web/src/index.css`. A decision
note (`.spec/decisions/00NN-semantic-colour-tokens.md`) records this.

## Behaviour

### Tokens

- `globals.css` `:root` and `.dark` define every value in the token table
  below. Light `background`, `card` and `popover` are pure white; light `muted`, `secondary`, `accent`, `sidebar`, `border` and `input` have hue about 255 and chroma at most 0.004 (neutral grey with a barely perceptible cool cast). Dark `background`, `card`, `popover`, `muted`, `accent` and `sidebar` have chroma at most 0.006. Colour comes from the brand blues, status tokens, icons and gradient headers, not from the page ground (user revision).
- `globals.css` defines `--success`, `--warning`, `--info`, each with a
  `-foreground`, plus a blue scale `--brand-1` (sky), `--brand-2` (brand
  blue) and `--brand-3` (indigo), each with a `-foreground`,, in both `:root` and `.dark`. `--destructive`
  gains a `--destructive-foreground`.
- `@theme inline` maps each new var to `--color-<name>`, so `bg-success`,
  `text-warning`, `border-info/30`, `bg-brand-1/10`, `from-brand-1/15` etc. work.
- `apps/web/src/index.css` stays exactly `@import "@proj/ui/globals.css";`.
- After the pass, no file under `apps/web/src` uses a raw Tailwind palette
  colour (`emerald-`, `amber-`, `blue-`, `red-`, `green-`, `yellow-`,
  `orange-`, `sky-`, `teal-`, `indigo-`). A grep for these finds nothing. Status and
  accent colour comes only from tokens.

### Status mapping

- One module, `apps/web/src/lib/status-tone.ts`, owns every status-to-tone
  mapping. The `StatusTone` union grows from
  `success | danger | neutral | muted` to
  `success | warning | info | danger | neutral | muted`.
- Each mapping is a typed `Record<Enum, StatusTone>` using
  `satisfies`, so adding an enum value to the contract breaks `check-types`.
- Every badge that shows a status in the tables below renders through
  `Badge` with the variant for its tone (see Badge). No call site picks colour
  classes itself.
- Colour is never the only signal. Every coloured badge keeps its text label,
  and coloured icons sit beside text (design-system rule, unchanged).

### Badge

- `packages/ui/src/components/badge.tsx` gains `success`, `warning` and
  `info` variants, styled the same way as the existing `destructive`
  (`bg-<x>/10 text-<x> dark:bg-<x>/20`, plus `border-<x>/30`). Editing an
  existing shadcn component's `cva` is the sanctioned way to add variants. No
  new component file is needed.
- `statusToneClassName` is replaced by `statusToneBadgeVariant:
  Record<StatusTone, BadgeVariant>`
  (`danger -> destructive`, `neutral -> outline`, `muted -> secondary`).
  `statusDotClassName` keeps its shape but uses tokens (`bg-success`,
  `bg-warning`, `bg-info`, `bg-destructive`, ...).
- Every other shadcn component this needs (`Card`, `Alert`, `Empty`,
  `Badge`, `Sidebar`) is already in `packages/ui/src/components`, so nothing
  gets added with the CLI. If implementation finds a gap, add it with
  `pnpm dlx shadcn@latest add <component> -c packages/ui`, never by hand.
- `Alert` gains `success`, `warning` and `info` variants in the same way as
  Badge, for the system-status, danger-zone and notice panels.

### Shared visual patterns (applied per screen below)

| Pattern | Where it lives | Classes / tokens |
| --- | --- | --- |
| **Page header icon tile** | `components/page/page-header.tsx` (already takes `icon`) | every page: icon in a `size-9 rounded-lg bg-brand-2/10 text-brand-2` tile |
| **Gradient header band** | `list-page-header.tsx` and the home hero only | `bg-gradient-to-r from-brand-1/15 via-brand-2/10 to-brand-3/5`; detail and form headers stay plain (icon tile only) |
| **Section icon** | `components/page/section-card.tsx`, `section-heading.tsx` | optional `icon` prop, `text-brand-2` |
| **Emphasis (no side borders)** | everywhere | **No side-border accents** (`border-l-*`, `border-s-*`) on cards or rows, anywhere (user revision). Use icon tiles and badges for emphasis. Cards keep the normal border and no tinted fill |
| **Summary/count card** | `summary-card.tsx`, `resident-home/count-card.tsx` | normal white card, normal border, no tinted fill; icon in a `size-9 rounded-lg` tile `bg-brand-1/15 text-brand-3`; `warning` prop switches only the tile to `bg-warning/10 text-warning` (optionally a warning Badge beside the number). Actions stay normal outline/secondary Buttons |
| **Empty state** | `components/states/empty-state.tsx` | optional `icon` in `EmptyMedia variant="icon"` with `bg-brand-1/15 text-brand-2`. Decided: empty states get icons, and the documented "no icon" rule in `empty-state.tsx` and `design-system.md` is updated |
| **Error state** | `components/states/error-state.tsx` | `Alert variant="destructive"`, unchanged colour |
| **Sidebar active item** | `components/shell/app-navigation.tsx` | uses `--sidebar-accent` (now blue-tinted) + `text-sidebar-primary` icon |

Every route keeps its existing layout. The pass adds colour only.

## Proposed tokens

Contrast ratios are approximate (oklch L to relative luminance). Implementation
must re-check each pair with a WCAG checker and nudge L if any falls below
the target: **4.5:1** for text, **3:1** for borders/icons/large text.

### `:root` (light)

| Token | Value | Pair / note | ≈ Contrast |
| --- | --- | --- | --- |
| `--background` | `oklch(1 0 0)` | | |
| `--foreground` | `oklch(0.20 0.03 262)` | on background | 15:1 |
| `--card` | `oklch(1 0 0)` | white, same as the page; cards separate by border | |
| `--card-foreground` | `oklch(0.20 0.03 262)` | | 16:1 |
| `--popover` | `oklch(1 0 0)` | | |
| `--popover-foreground` | `oklch(0.20 0.03 262)` | | 16:1 |
| `--primary` | `oklch(0.488 0.243 264.376)` | unchanged brand blue | |
| `--primary-foreground` | `oklch(0.985 0.01 255)` | on primary | 6.5:1 |
| `--secondary` | `oklch(0.955 0.004 255)` | | |
| `--secondary-foreground` | `oklch(0.27 0.05 262)` | on secondary | 11:1 |
| `--muted` | `oklch(0.96 0.004 255)` | | |
| `--muted-foreground` | `oklch(0.50 0.03 258)` | on background / muted | 5.5:1 / 5.1:1 |
| `--accent` | `oklch(0.955 0.003 255)` | subtle tinted-neutral hover surface (not a brand colour) | |
| `--accent-foreground` | `oklch(0.22 0.03 262)` | on accent | 13:1 |
| `--brand-1` | `oklch(0.56 0.13 232)` | **new** sky-blue; icons, gradient start; text on white | 4.6:1 |
| `--brand-1-foreground` | `oklch(0.99 0.01 232)` | on brand-1 | 4.6:1 |
| `--brand-2` | `oklch(0.488 0.243 264.376)` | **new**, equals `--primary`; icon tiles | 6.5:1 |
| `--brand-2-foreground` | `oklch(0.985 0.01 255)` | | 6.5:1 |
| `--brand-3` | `oklch(0.40 0.20 275)` | **new** deep indigo-blue; gradient end, count-card icons | 9:1 |
| `--brand-3-foreground` | `oklch(0.985 0.01 275)` | | 9:1 |
| `--success` | `oklch(0.52 0.13 152)` | **new**; text on white and on `/10` tint | 4.9:1 |
| `--success-foreground` | `oklch(0.99 0.01 152)` | | 4.9:1 |
| `--warning` | `oklch(0.53 0.13 65)` | **new**, dark amber so text passes; text on white | 4.6:1 |
| `--warning-foreground` | `oklch(0.99 0.01 85)` | | 4.6:1 |
| `--info` | `oklch(0.52 0.15 240)` | **new**, sky-blue, distinct from primary's 264 hue | 5.0:1 |
| `--info-foreground` | `oklch(0.99 0.01 240)` | | 5.0:1 |
| `--destructive` | `oklch(0.577 0.245 27.325)` | unchanged | 4.5:1 on white |
| `--destructive-foreground` | `oklch(0.99 0.01 27)` | **new** | 4.5:1 |
| `--border` | `oklch(0.91 0.004 255)` | | decorative |
| `--input` | `oklch(0.88 0.004 255)` | slightly darker than border for field edges | ≈1.5:1 (shadcn parity) |
| `--ring` | `oklch(0.62 0.17 264)` | blue focus ring (was grey) | 3.3:1 on white |
| `--chart-1` | `oklch(0.68 0.12 232)` | sky | |
| `--chart-2` | `oklch(0.55 0.20 262)` | blue | |
| `--chart-3` | `oklch(0.42 0.19 275)` | indigo | |
| `--chart-4` | `oklch(0.58 0.17 305)` | violet | |
| `--chart-5` | `oklch(0.60 0.03 258)` | slate | |
| `--sidebar` | `oklch(0.975 0.003 255)` | | |
| `--sidebar-foreground` | `oklch(0.20 0.03 262)` | | 14:1 |
| `--sidebar-primary` | `oklch(0.488 0.243 264.376)` | | |
| `--sidebar-primary-foreground` | `oklch(0.985 0.01 255)` | | 6.5:1 |
| `--sidebar-accent` | `oklch(0.92 0.035 260)` | active/hover row | |
| `--sidebar-accent-foreground` | `oklch(0.27 0.08 264)` | on sidebar-accent | 10:1 |
| `--sidebar-border` | `oklch(0.91 0.004 255)` | | |
| `--sidebar-ring` | `oklch(0.62 0.17 264)` | | |

### `.dark`

| Token | Value | Pair / note | ≈ Contrast |
| --- | --- | --- | --- |
| `--background` | `oklch(0.16 0.006 262)` | near-neutral dark, faint cool cast | |
| `--foreground` | `oklch(0.97 0.008 255)` | | 16:1 |
| `--card` | `oklch(0.21 0.006 262)` | | |
| `--card-foreground` | `oklch(0.97 0.008 255)` | | 14:1 |
| `--popover` | `oklch(0.21 0.006 262)` | | |
| `--popover-foreground` | `oklch(0.97 0.008 255)` | | 14:1 |
| `--primary` | `oklch(0.62 0.19 262)` | lighter than today's dark primary (0.424), so it reads on navy | 4.6:1 on card |
| `--primary-foreground` | `oklch(0.16 0.02 262)` | dark text on lighter primary | 5:1 |
| `--secondary` | `oklch(0.28 0.03 262)` | | |
| `--secondary-foreground` | `oklch(0.97 0.008 255)` | | 12:1 |
| `--muted` | `oklch(0.27 0.006 262)` | | |
| `--muted-foreground` | `oklch(0.72 0.025 258)` | on background / card | 7:1 / 6:1 |
| `--accent` | `oklch(0.27 0.005 262)` | subtle tinted-neutral hover | |
| `--accent-foreground` | `oklch(0.97 0.008 255)` | | 12:1 |
| `--brand-1` | `oklch(0.76 0.11 232)` | sky | 8:1 on card |
| `--brand-1-foreground` | `oklch(0.18 0.03 240)` | | 8:1 |
| `--brand-2` | `oklch(0.62 0.19 262)` | equals dark `--primary` | 4.6:1 on card |
| `--brand-2-foreground` | `oklch(0.16 0.02 262)` | | 5:1 |
| `--brand-3` | `oklch(0.68 0.16 278)` | indigo, lifted for dark | 5:1 on card |
| `--brand-3-foreground` | `oklch(0.16 0.02 275)` | | 5.5:1 |
| `--success` | `oklch(0.74 0.15 152)` | | 7.5:1 on card |
| `--success-foreground` | `oklch(0.20 0.04 152)` | | 7:1 |
| `--warning` | `oklch(0.80 0.14 75)` | | 9:1 on card |
| `--warning-foreground` | `oklch(0.22 0.05 60)` | | 8:1 |
| `--info` | `oklch(0.74 0.12 238)` | | 7:1 on card |
| `--info-foreground` | `oklch(0.20 0.04 240)` | | 7:1 |
| `--destructive` | `oklch(0.704 0.191 22.216)` | unchanged | 5.5:1 on card |
| `--destructive-foreground` | `oklch(0.20 0.04 25)` | **new** | 5.5:1 |
| `--border` | `oklch(0.85 0.03 255 / 12%)` | | |
| `--input` | `oklch(0.85 0.03 255 / 18%)` | | |
| `--ring` | `oklch(0.62 0.17 262)` | | |
| `--chart-1` | `oklch(0.78 0.11 232)` | sky | |
| `--chart-2` | `oklch(0.66 0.18 262)` | blue | |
| `--chart-3` | `oklch(0.58 0.18 278)` | indigo | |
| `--chart-4` | `oklch(0.72 0.15 305)` | violet | |
| `--chart-5` | `oklch(0.70 0.03 258)` | | |
| `--sidebar` | `oklch(0.19 0.006 262)` | | |
| `--sidebar-foreground` | `oklch(0.97 0.008 255)` | | 15:1 |
| `--sidebar-primary` | `oklch(0.62 0.19 262)` | | |
| `--sidebar-primary-foreground` | `oklch(0.16 0.02 262)` | | 5:1 |
| `--sidebar-accent` | `oklch(0.28 0.05 262)` | | |
| `--sidebar-accent-foreground` | `oklch(0.97 0.008 255)` | | 12:1 |
| `--sidebar-border` | `oklch(0.85 0.03 255 / 12%)` | | |
| `--sidebar-ring` | `oklch(0.62 0.17 262)` | | |

Badge text sits on a 10% (light) or 20% (dark) tint of its own token. The tint
lowers contrast slightly, by about 0.2 to 0.4 of a ratio point. Each light
status token was chosen with about 0.3 headroom over 4.5:1 to cover this.
`warning` has the least headroom, so check it first.

Chart order (`chart-1..5`) changes from five near-identical blues to sky, blue,
indigo, violet, slate. The steps differ in both lightness and hue, so neighbouring series stay apart. No amber: amber is kept for `--warning`, and no current chart needs a sixth contrasting series. Multi-series charts in `components/sensors/sensor-line.tsx` and
the readings/trends charts become distinguishable. Single-series charts that use `chart-1` become sky-blue.
`--brand-1` and `--info` are both sky hues. `--info` appears only on status badges and `--brand-1` only on decoration and gradients, so they never sit side by side as meanings.

## Status-to-tone mapping

Enum values are from `packages/api/src/schema.ts`.

**Report urgency** (`LOW | MEDIUM | HIGH | URGENT`). Used in
`components/reports/report-urgency-badges.tsx`, `report-card.tsx`,
`estates/$estateId/-components/estate-details-page/recent-reports.tsx`,
`estate-reports-results.tsx`, `work-order-detail-summary.tsx`.

| Value | Tone | Badge variant |
| --- | --- | --- |
| `LOW` | neutral | `outline` |
| `MEDIUM` | info | `info` |
| `HIGH` | warning | `warning` |
| `URGENT` | danger | `destructive` |
| `isSafety: true` (flag) | danger | `destructive` (unchanged) |

**Report / work-order status** (`OPEN | ASSIGNED | IN_PROGRESS | CLOSED`, shared
by reports and work orders). Today `report-metadata.tsx` renders the raw enum in
a default badge. Add a label map, used by `report-metadata.tsx`, the
work-order list and detail pages, and `work-order-progress.tsx`.

| Value | Label | Tone | Variant |
| --- | --- | --- | --- |
| `OPEN` | Open | neutral | `outline` |
| `ASSIGNED` | Assigned | info | `info` |
| `IN_PROGRESS` | In progress | warning | `warning` |
| `CLOSED` | Closed | success | `success` |

**Asset condition** (`GOOD | NEEDS_ATTENTION | FAULTY | UNASSESSED`/null).
Used in `assets/-components/condition-badge.tsx`.

| Value | Tone | Variant |
| --- | --- | --- |
| `GOOD` | success | `success` (was `default` blue) |
| `NEEDS_ATTENTION` | warning | `warning` (was `secondary`) |
| `FAULTY` | danger | `destructive` |
| `UNASSESSED` / null | neutral | `outline` |

**Device status** (`AWAITING_FIRST_READING | ONLINE | OFFLINE | DEACTIVATED`).
Used in `components/badges/device-status-badge.tsx`. `AWAITING_FIRST_READING`
changes from neutral to info. The rest are unchanged.

| `ONLINE` success | `OFFLINE` danger | `AWAITING_FIRST_READING` info | `DEACTIVATED` muted |
| --- | --- | --- | --- |

**Lifecycle** (`ACTIVE | RETIRED`, `inactive` boolean).
`lifecycle-status-badge.tsx`: active is success, inactive/retired is muted.
Retired is a normal end state, not a failure, so it changes from danger to muted.

**Inspection check** (`OVERDUE | DUE | DONE` + result `PASS | FAIL`).
`inspections/-components/inspections-page/status-badge.tsx`:
`OVERDUE` danger, `DUE` info, `DONE · Pass` success, `DONE · Fail` warning.
The `blue-*`/`emerald-*` consts are deleted.

**Notification kind** (`ANOMALY | SERVICE_DUE | REPAIR_PREDICTED`) and
**alert response** (`NONE | ACKNOWLEDGED | DISMISSED`).
`notifications-page/notification-item.tsx`, `alert-response-summary.tsx`,
`shell/notification-bell.tsx`:

| Kind | Tone + icon | Response | Tone |
| --- | --- | --- | --- |
| `ANOMALY` | danger, `TriangleAlert` | `NONE` | warning ("Needs response") |
| `SERVICE_DUE` | info, `Wrench` | `ACKNOWLEDGED` | success |
| `REPAIR_PREDICTED` | warning, `TrendingDown` | `DISMISSED` | muted |

Unread notification rows get a primary-toned kind icon tile and an "Unread" `info` Badge (no side border). The bell's count
badge uses `destructive`.

**Duplicate suspicion** (`SUSPECTED | CONFIRMED | REJECTED`).
`components/reports/duplicate-badges.tsx`: suspected/"to review" is warning,
confirmed "Duplicate" is muted, rejected shows no badge (unchanged).

**Reading import row** (`IMPORTED | DUPLICATE | INVALID`, and
`CREATED | ALREADY_STORED | INVALID | CONFLICT`). Import batch pages:
imported/created success, duplicate/already-stored muted, invalid danger,
conflict warning.

**Suspect reading** (`GAP | DUPLICATE_TIMESTAMP | OUT_OF_RANGE | ANOMALY`).
`asset-monitoring-cells.tsx`, `grouped-readings-table.tsx`: `ANOMALY` and
`OUT_OF_RANGE` danger, `GAP` and `DUPLICATE_TIMESTAMP` warning. Suspicion
state `SUSPECTED` warning, `CONFIRMED` danger, `REJECTED` muted.

**Failure-risk / service due** (`OVERDUE | DUE`, `PREDICTION | INTERVAL |
NEVER_INSPECTED`). `failure-risk` page and `asset-service-interval-card.tsx`:
overdue danger, due warning, never-inspected info.

**Invitations / role**. Pending invitations (`pending-invitation.tsx`,
`outstanding-invitation.tsx`, `access-controls.tsx` "n pending") are info.
"Active" member is success. Role-name badges stay `secondary`.

**Work-order type** (`BREAKDOWN_REPAIR | PREVENTIVE`): breakdown warning,
preventive info. **Inspection outcome** (`PASS | FAIL`): success / danger.

## Screen-by-screen inventory

Paths are relative to `apps/web/src/routes`. "Header" means the
`PageHeader`/`ListPageHeader`/`DetailPageHeader`/`FormPageHeader` icon tile
(gradient band on list pages and home only). 37 route files already render one of these. There are no card side-border accents (user revision); emphasis is an icon tile or a Badge.

| Screen | Files | Colour added | Tokens |
| --- | --- | --- | --- |
| Home (public) | `-components/home-page/home-page.tsx`, `home-feature-cards.tsx`, `home-sign-in-card.tsx`, `home-no-workspace.tsx` | hero gradient `from-brand-1/15 via-brand-2/10 to-brand-3/5`; feature card icon tiles cycling brand-1/2/3 | brand-1..3 |
| System status | `-components/home-page/system-status.tsx` | `Alert` success when up, destructive when down; status dot | success, destructive |
| Resident home | `-components/home-page/resident-home/*.tsx` (`count-card.tsx`, `report-fault-link.tsx`, `resident-dashboard.tsx`) | count-card icon tiles; report-fault CTA card with a primary icon tile | brand-1, brand-3, primary, warning |
| Login / register | `login/-components/login-page.tsx`, `register/-components/registration-page.tsx` | brand icon tile, tinted card header | primary |
| Logout, `api/auth/*` | `logout/index.tsx`, `api/auth/*/index.tsx` | none (redirect-only) | - |
| Estate directory | `_auth/estates/-components/estate-list-page/estate-card.tsx`, `estate-empty-state.tsx`, `pending-invitations.tsx`, `pending-invitation.tsx` | header; estate card icon tile + hover `border-primary/40`; invitation cards with an `info` "Pending" Badge; empty state icon | primary, info, brand-1 |
| New / edit estate | `_auth/estates/-components/estate-editor-page/*` | header; `estate-creation-status.tsx` uses Alert success/destructive; **`estate-danger-zone.tsx`** card gets `border-destructive/40`, `TriangleAlert` icon in a `bg-destructive/10 text-destructive` tile | destructive, success |
| Estate overview | `$estateId/-components/estate-details-page/*` (`recent-reports.tsx`), `components/page/summary-card.tsx` | header; summary cards icon tiles, warning-toned tile when non-zero; recent-report urgency badges | brand-3, warning, urgency map |
| Assets register | `$estateId/assets/-components/asset-register-page/*`, `condition-badge.tsx`, `asset-views-nav.tsx`, `history-asset-list.tsx`, `inspection-asset-list.tsx` | header; condition + lifecycle badges; monitoring-flag badges | condition map |
| Asset detail tabs | `$estateId/assets/$assetId/-components/*` (overview `asset-forecast-card.tsx`, `trends-card`, `anomaly-alerts-section`, `asset-devices/device-item.tsx`, `asset-maintenance/*`), `_details/*/index.tsx` | header; section icons; forecast card warning/danger icon tile or Badge by risk; unresolved anomaly alert `destructive` Badge + icon; device badges; source badges stay secondary | brand-2, status maps |
| Asset history | `_details/history/-components/history-timeline-entry.tsx`, `history-entry-details.tsx`, `history-asset-frame.tsx` | timeline dot coloured per entry kind (condition = condition tone, maintenance = info, inspection = outcome tone) | status maps |
| Condition history | `assets/$assetId/condition/-components/*` | header; condition badges; "Current" badge info | condition map |
| Asset forms (new/edit/device new/replace/inspection new/maintenance new) | `assets/-components/asset-form/*`, `assets/$assetId/-components/device-form/*`, `inspections/new/-components/*`, `maintenance/new/-components/record-repair-form.tsx`, `devices/*/-components` | form header icon tile; `saved-inspection-notice.tsx` Alert success | primary, success |
| Inspection detail | `assets/$assetId/inspections/$inspectionId/-components/*` | header; outcome badge | outcome map |
| Asset readings | `assets/$assetId/readings/-components/*`, `-components/grouped-readings/*` | header; chart palette; suspect badges | chart-1..5, suspect map |
| Devices (estate + asset devices settings) | `$estateId/devices/index.tsx`, `assets/devices/-components/metric-policy-settings/policy-status.tsx` | header; device badges; policy "configured" success / "not set" muted | device map |
| Sensors | `$estateId/sensors/index.tsx`, `sensors/all/index.tsx`, `components/sensors/*` | header; sensor line colours; paused badge muted | chart-*, muted |
| Readings + imports | `$estateId/readings/-components/*`, `readings/imports/-components`, `readings/imports/$batchId/-components` | header; import row-outcome badges; batch summary counts coloured | import map |
| Reports (estate) | `$estateId/reports/-components/estate-reports-page/*`, `report-filters/*`, `$reportId/-components`, `components/reports/*` | header; urgency + status + duplicate badges; report card urgency Badge (HIGH warning, URGENT destructive) | urgency, status maps |
| Work orders | `$estateId/work-orders/-components/work-order-list-page/*`, `$workOrderId/-components/work-order-detail-page/*` (`work-order-progress.tsx`, `work-order-detail-summary.tsx`), `new/-components` | header; status badge; progress stepper current step primary, done success; type badge | status, type maps |
| Inspections list | `$estateId/inspections/-components/inspections-page/*` | header; `status-badge.tsx` re-toned; generation status Alert | inspection map |
| Failure risk | `$estateId/failure-risk/index.tsx` | header; risk/due badges; overdue `destructive` Badge | failure-risk map |
| Asset categories | `$estateId/asset-categories/-components/*`, `$interval/index.tsx` | header; "Fails silently" badge warning | warning |
| Locations | `$estateId/locations/-components/locations-page.tsx`, `$estateId/-components/locations-section` | header; block/level icons brand-2 | brand-2 |
| Documents | `$estateId/documents/-components/*` | header; doc-type icon (`INVOICE` info, `SERVICE_REPORT` brand-3) | info, brand-3 |
| Council + invitations | `$estateId/council/-components/council-page/*`, `council/invitations/index.tsx` | header; pending = info, active = success; remove-member stays destructive | info, success |
| Roles | `$estateId/roles/-components/*`, `roles/new/-components`, `roles/$roleId/edit/-components` | header; role badges secondary | - |
| Notification settings | `$estateId/notification-settings/-components/*` | header; section icons | brand-2 |
| My reports (resident) | `_auth/reports/-components/my-reports-page/*`, `reports/new/-components/new-report-page/*`, `reports/$reportId/-components` | header; status + urgency badges; history timeline dots | status, urgency maps |
| Notifications | `_auth/notifications/-components/notifications-page/*` | header; kind icon + tone; unread Badge | notification map |
| Invitations | `_auth/invitations/index.tsx` | header; pending cards with an `info` Badge | info |
| Account | `_auth/account/index.tsx` | header | primary |
| Admin users | `_auth/admin/users/-components/admin-users-page/*`, `_auth/admin/-components/member-estates/*` | header (`admin-users-header.tsx`); platform-admin badge info | info |
| Shell | `components/shell/*` (`app-navigation.tsx`, `header.tsx`, `notification-bell.tsx`, `sidebar-header-bar.tsx`) | sidebar active tokens; brand mark primary; bell count destructive | sidebar-*, destructive |
| Shared states | `components/states/empty-state.tsx`, `error-state.tsx`, `not-found-page.tsx` | empty icon tile; not-found icon tile | brand-1, brand-2, destructive |

### Screens not yet compliant with rules 8-10

Rule 10 refactors happen as part of touching each screen:

- **Flat route files with inline UI.** These `index.tsx` files have UI inline
  and no `-components/` folder: `_auth/account/index.tsx`,
  `_auth/invitations/index.tsx`, `$estateId/devices/index.tsx`,
  `$estateId/failure-risk/index.tsx`, `$estateId/sensors/index.tsx`,
  `sensors/all/index.tsx`, `$estateId/work-orders/index.tsx` (also holds
  status logic). Move each one's screen into a beside-it `-components/` folder
  only if the colour change makes the file non-trivial. Otherwise leave it
  (YAGNI). Implementation confirms per file.
- **Hand-rolled controls.** `assets/$assetId/-components/grouped-readings/grouped-readings-table.tsx`
  uses `render={<button type="button" />}` on a shadcn primitive, which is
  allowed. A full grep found no raw `<button>`, `<input>`, `<select>` or
  `<table>` elsewhere in `src`. No migration needed.
- **Raw palette colours** (to be removed): `lib/status-tone.ts`,
  `inspections-page/status-badge.tsx`, `components/page/summary-card.tsx`.

## Data

None. No Prisma model changes.

## API

None. No endpoints added or changed. Enum values above are read from the
existing contract.

## Testing

Per `.spec/testing.md`, write each failing test first, then implement.

**Worth testing** (Vitest, `apps/web/tests/`):

- `tests/lib/status-tone.test.ts`: extend. One `it` per mapping table. Each
  enum value maps to the stated tone, and each tone maps to the stated badge
  variant. Iterate the enum literal list so a missing key fails.
- `tests/components/badges/device-status-badge.test.tsx`,
  `lifecycle-status-badge.test.tsx`: update for `AWAITING_FIRST_READING -> info`
  and `retired -> muted`. These are deliberate behaviour changes, so they are
  separate edits, not edits to make code pass.
- New `tests/components/reports/report-urgency-badges.test.tsx` and a status
  badge test. Each renders the human label, queried by role/text, and puts the
  variant on `data-variant`. Assert only on the label and `data-variant`
  (the `Badge` `state.variant`), never on class strings.
- `report-metadata`: renders "In progress", not `IN_PROGRESS`.
- `tests/components/states/empty-state.test.tsx`: an optional icon renders
  decoratively (`aria-hidden`), so the accessible name stays the title.

**Not worth unit testing**: the oklch values, gradients, icon
colours and dark-mode appearance. jsdom has no layout or computed colour.
Check these by hand. Guard grep also covers `border-l-` / `border-s-`, which must find nothing. Run `pnpm dev`, then walk through each inventory row in light and
dark mode, and run a contrast checker on every pair in the token tables.
Screenshots of each screen go in the PR.

**Guard**: a one-off grep in review (not a test) for raw palette classes in
`apps/web/src`. It should find nothing.

## Docs to update

- `.docs/frontend/design-system.md`: tokens section (new semantic tokens,
  tinted palette, the "no custom colour tokens" rule replaced), status-tone
  mapping, Badge/Alert variants, shared visual patterns, empty-state icon rule.
- `.docs/frontend/shell.md`: sidebar colours, bell badge.
- Every feature file whose badges change: `estate-reports.md`,
  `resident-reports.md`, `fault-report-duplicates.md`, `work-orders.md`,
  `assets.md`, `asset-history.md`, `devices.md`, `inspection-list.md`,
  `inspections.md`, `failure-risk.md`, `notifications.md`,
  `council-invitations.md`, `estates.md`, `reading-imports.md`,
  `readings.md`, `flatlined-sensors.md`, `service-intervals.md`,
  `resident-dashboard.md`, `documents.md`. Each gets a one-line note on which
  tone each status uses, pointing to `design-system.md`.
- `.docs/README.md`: no new files, so no index change.
- No `.docs/api/` changes.
- New decision note in `.spec/decisions/` for semantic colour tokens.

## Edge cases

- **Dark mode primary flip**: dark `--primary` gets lighter with dark
  foreground text. Check every `bg-primary text-primary-foreground` button and
  badge, and the sidebar primary.
- **Charts**: `components/sensors/sensor-line.tsx` and the shadcn `chart.tsx`
  config may hard-code a `chart-N` per series. Recolouring `chart-2..5` changes
  existing series colours. Check the readings and trends charts.
- **Focus ring** changes from grey to blue. It must stay visible on
  `bg-primary` buttons (ring offset), with 3:1 against the adjacent colour.
- **Warning on tint**: amber text on `bg-warning/10` has the least
  contrast headroom. If it fails AA, darken `--warning` L to 0.50 rather than
  making the badge text bold.
- **Colour-blind users**: success (green) vs destructive (red) must not be
  the only signal. Labels stay, and danger icons use a distinct shape
  (`TriangleAlert`).
- **Unknown enum values at runtime** (older client, newer server): the
  mapping falls back to `neutral`/`outline`, not a crash.
- **Print / high-contrast mode**: out of scope beyond not breaking.

## Out of scope

- Backend, API contract or database changes.
- New dependencies (fonts, icon packs, colour libraries). lucide is already in use.
- Layout changes, new screens, re-ordering content, copy changes beyond
  status labels.
- A theme picker or per-estate branding.
- Re-running the shadcn preset to a different base colour.
- Visual-regression tooling (Playwright/Chromatic).
- Splitting flat route files that the colour pass doesn't make non-trivial.

## Resolved decisions

Agreed with the user (previously open questions):

1. **No teal.** Highlights, icon tints, card accents and gradients use the blue
   scale `--brand-1..3`. `--accent` (shadcn hover/menu surface) stays a subtle
   tinted neutral, not a brand colour.
2. **`ASSIGNED` is info.** Only `IN_PROGRESS` is warning. `OPEN` becomes
   neutral, so the steps stay visually distinct.
3. **Retired assets are muted**, not destructive.
4. **Empty states get icons.** The documented "no icon" rule in
   `components/states/empty-state.tsx` and `.docs/frontend/design-system.md`
   is updated.
5. **The gradient header** goes on list pages (`ListPageHeader`) and the home
   page only. Detail and form pages keep the plain header with the icon tile.
6. **A manual contrast check is enough.** No automated contrast test and no new
   dependency.

## Revision (2026-11-09)

The user rejected the gradient header band after seeing it built. It is removed: `PageHeader` has no `gradient` prop, and no page uses a gradient. Every reference to gradients above is superseded. Headers keep the icon tile only.
