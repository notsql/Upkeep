# Dashboard design conventions

ID-93 implementation on `feat/ui-redesign`, incorporating the council-invitation
and asset-retirement features now merged into main. The UI uses existing shadcn
components from `packages/ui`, lucide icons,
Tailwind and next-themes. No new package or database setting is needed. The
portfolio Home uses the read-only summary endpoint described in
[dashboard.md](dashboard.md).

## Themes and tokens

`apps/web/src/index.css` overrides the shared semantic CSS tokens. The root
ThemeProvider defaults to light; next-themes stores explicit light/dark selection
under its existing `theme` storage key. `ThemeToggle` names the next mode and
waits for mount before enabling itself. Use token classes, never hard-coded
feature-specific light/dark colors.

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| background / foreground | `#f5f7fb` / `#17273a` | `#0c1522` / `#e9eff7` | Page and normal text |
| card / card-foreground | white / `#17273a` | `#142134` / `#e9eff7` | Surfaces |
| primary / primary-foreground | `#153e63` / white | `#7dd3c0` / `#102c26` | Primary action |
| muted / muted-foreground | `#edf1f6` / `#52647a` | `#1d2d43` / `#acbbcf` | Secondary information |
| accent / accent-foreground | `#def3ed` / `#145c51` | `#193d3b` / `#a8ebd9` | Selected navigation |
| input | `#8291a4` | `#657993` | Control boundary |
| border | `#dce3ec` | `#30435c` | Decorative surface divider |
| ring | `#147d70` | `#7dd3c0` | Visible keyboard focus |
| destructive | `#b42335` | `#ff8996` | Destructive actions/errors |
| status-active / status-active-foreground | `#dcfce7` / `#166534` | `#123524` / `#86efac` | Active estate/asset badge |
| status-inactive / status-inactive-foreground | `#fee2e2` / `#991b1b` | `#431c25` / `#fda4af` | Inactive estate/Retired asset badge |

Calculated solid-token contrast: primary text 11.05:1 light / 8.47:1 dark;
muted text against cards 6.06:1 / 8.30:1; input borders against cards
3.21:1 / 3.63:1. These calculations do not verify hover/disabled/translucent
combinations or rendered browser contrast; include those in manual review.
Lifecycle badge foreground/background contrast is 6.49:1 green / 6.80:1 red
in light mode, and 9.58:1 green / 7.76:1 red in dark mode.

The existing font stack is retained. Page titles are 28px (32px at sm), section
headings 20px, shared card/dialog titles 18px and ordinary controls/table content
14–16px. Spacing uses the existing 4/8/12/16/24/32px Tailwind scale. Surface radius
is 12px; inputs and controls use rounded corners. The existing shadcn Button
variants supply rounded 14px controls, a 44px default/large height and smaller
compact actions. Do not rely on color alone for status or selected navigation.

## Shell and responsive navigation

`AppShell` owns Header, AppNavigation, the skip link and focusable content target.
Individual screens own their main landmark. Public visitors/loading sessions see
the public header. Home has one Create account action in its content, with no
duplicate Register header link; header/home authentication actions use Sign in. Signed-in users get the sidebar at >=768px and bottom app bar
below 768px. The sidebar is 240px, independently scrollable on short screens;
workspace content reserves its width. The compact sticky top bar contains the
brand, theme switch and circular profile menu; it has no estate selector. The profile menu shows
the signed-in email, Settings to the existing `/account` page, and Sign out via
`/logout`. Account is absent from the desktop sidebar and remains available in
mobile navigation. The circle uses the existing shadcn Button and UserRound icon.

| Context | Desktop sidebar | Mobile |
| --- | --- | --- |
| Global | Home, Estates, admin-only Admin users | Fixed Home / Estates / More |
| Estate owner | Global links + Overview, Assets, Council | Same bottom bar + contextual Overview / Assets / Council links |
| Estate member/delegate | Global links + Overview, allowed Council | Same bottom bar + Overview / allowed Council links |

More uses shadcn DropdownMenu with Settings and allowed Admin users. Estate
context comes from route/breadcrumbs/content/sidebar. On estate pages, a shadcn
estate DropdownMenu replaces the sidebar estate heading and sits above mobile
estate links. It lists accessible estates by name/code, labels inactive entries,
and opens the chosen estate's Overview. The header stays compact. Estates remains
the directory for browsing/searching/creating estates; see [shell.md](shell.md).
Locations remains a section within Overview; it has no separate navigation item. All destinations are real links with
visible text/icons; selected links have `aria-current="page"` and heavier text.
Exact router matching ignores filter search parameters and prevents
parent links being highlighted alongside the current page. Explicit destination
state retains Assets on nested asset screens; Overview stays selected for section anchors such as #locations. Real-router regressions cover these cases.
Base UI provides menu keyboard handling and dialog focus behavior. Location
dialogs return focus to their node menu (or Add block if the node disappeared);
Admin estate-access dialogs return to Manage estates. Verify these
with the real browser when reviewing this story.

Assets currently requires estate ownership. Council requires API
`canInviteMembers || canManageInvitationPermissions`. Admin requires the existing
application admin role. Navigation uses the current URL, not a remembered estate
on global pages. The cached useEstate query remains session-gated. Future damage/reporting screens
should be added only when implemented; revise the current navigation then.

The mobile bar reserves `max(0.5rem, env(safe-area-inset-bottom))`; content has
`calc(5.5rem + env(safe-area-inset-bottom))` bottom padding. Dialog contents have
`max-height: calc(100dvh - 2rem)` and vertical scrolling. This is implementation
intent; phone keyboards and zoom still require visual verification.

## Pages, actions and forms

Shared app pieces live in `apps/web/src/components/`:

- `PageHeader`: title, optional description/status, breadcrumbs, contextual actions.
  Breadcrumbs wrap, use real route links, and mark the current item. Estate names
  use loaded records; asset screens reuse the existing cached, session-gated useEstate query for the
  estate name, with a temporary Estate label while loading.
- `FormActions`: submit label/pending state and optional Cancel callback; disables
  both while pending. Cancel is `type="button"`. Estate creation returns to
  Estates; asset creation to the register; editing returns to the details page.
- `ThemeToggle`, `AppShell`, `AppNavigation` and `NotFoundPage`: shared composition,
  not a configurable component framework.

Use `page-layout` (max width 72rem, responsive gutters), `max-w-3xl` for editors,
`form-surface` for forms, `detail-grid` for definition-list metadata and
`section-surface` for independent sections. Avoid wrapping every individual field
in a card. Long metadata wraps and action groups use `page-actions`/flex-wrap.

Example using existing shared pieces:

```tsx
import { PageHeader } from "@/components/page-header";
import { FormActions } from "@/components/form-actions";

<main className="page-layout max-w-3xl">
  <PageHeader title="Edit estate" breadcrumbs={[
    { label: "Estates", to: "/estates" }, { label: "Edit estate" },
  ]} />
  <form className="form-surface" onSubmit={handleSubmit}>
    {/* Existing shadcn labelled fields and validation */}
    <FormActions label="Save changes" pending={pending} onCancel={cancel} />
  </form>
</main>
```

Use shadcn Input/Select/Textarea/Checkbox and their labels; retain feature
validation. Mark optional fields and explain required fields in estate/asset
editors. Asset errors remain linked by aria-invalid/aria-describedby. Long estate/asset
editors and device registration use full pages; short location/assessment tasks
use existing Dialogs, destructive actions use confirmation Dialogs and email
invitations stay inline. Cancel returns to the parent page or dismisses the popup.
Keep inputs
on failures. Use the primary Button variant for the main task, outline for
secondary actions, destructive for retirement/deactivation/removal. Destructive
confirmations identify their target and state the actual effect. Exact code/asset
reference, retirement date constraints and pending-close prevention are preserved.

## Tables and feedback

Assets and Admin Users use cards below 768px and shadcn Table at wider widths.
`lib/use-mobile.ts` uses a reactive matchMedia subscription and a stable server
snapshot. Only one results presentation mounts from the same query data; resizing
preserves filters/selection without adding list requests. Mobile cards preserve
all fields and controls. Desktop tables keep a named, keyboard-reachable overflow
region. Use real linked names/references, not row-only mouse handlers.

Asset search remains visible. Mobile Filters shows the count of applied secondary
filters (excluding search/default Active). The Dialog starts with applied values;
Apply commits, Cancel/X/Escape discard, Clear secondary filters resets the draft
and retains search. Page-level Clear filters clears everything. Desktop filters
apply immediately. Existing URL/back navigation and order by reference remain.

`LifecycleStatusBadge` wraps the existing shadcn Badge for estate/asset lifecycle
status: green Active, red Inactive (estate) or Retired (asset), with visible words
and a matching border in light/dark themes. ConditionBadge stays separate from lifecycle status: Good green, Needs attention
amber, Faulty red and Not assessed yet neutral, with visible labels. Amber tokens
are #fef3c7/#92400e light and #3d3015/#fde68a dark.
Details sections retain meaningful headings and history dates. Loading is visible
status/aria-live text; spinners are decorative when text already announces it.
Estates uses shadcn Empty for no results and Alert + Retry for failures. Other
features retain their labelled alerts and existing retry actions. In-app and email
invitation feedback remain distinct. Success uses the existing Sonner toasts and
query invalidation. Known internal SQL/exception messages in 5xx estate-family errors receive a
generic retry message. Existing actionable messages such as invitation-verification
failures are preserved; 401 explains sign-in verification.

## Adding a screen and reviewing this change

Place routes in directories with adjacent `-components/` for route-local UI.
Use the shared shell/header/tokens, existing shadcn components and generated API
hooks. Fetch no private data before session readiness. Preserve current permission
checks, query keys and invalidations; visual work does not extend authorization.

Automated tests cover navigation context/capabilities, selected links, More items,
theme storage, profile-menu Settings/sign-out navigation, headers, form cancellation/pending behavior, table accessibility,
missing-page recovery and retained estate/invitation/asset/admin workflows. Tests
were observed failing before the new behavior was implemented. jsdom does not
prove responsive geometry, real focus restoration or browser contrast.

Manual acceptance remains: 360px phone, 768px tablet, 1280–1440px desktop and
200% zoom, both themes; long estate names/emails/paths; mobile cards and desktop tables/ sidebar;
keyboard-only navigation/More/dialogs; short dialog viewports/mobile keyboard;
content clear of the bottom bar; theme persistence after refresh; owner/delegate/
member/admin visibility. Keep ID-93 pending this visual review.
