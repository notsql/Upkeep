# Dashboard design conventions

ID-93 implementation on `feat/ui-redesign`, incorporating the council-invitation
and asset-retirement features now merged into main. The UI uses existing shadcn
components from `packages/ui`, lucide icons,
Tailwind and next-themes. No new package or database setting is needed. The
portfolio Home uses the read-only summary endpoint described in
[dashboard.md](dashboard.md).

## Themes and tokens

The look comes only from shadcn: preset `b1Z5bafVC` (style `base-vega`, base
colour `neutral`, lucide icons, menu colour `default-translucent`), installed into
`packages/ui`. Its tokens (light `:root` and `.dark`) live in
`packages/ui/src/styles/globals.css`. `apps/web/src/index.css` is exactly
`@import "@proj/ui/globals.css";` - no custom tokens, no `[data-slot]` overrides,
no `@layer components` classes, no media queries. Re-theme by re-running the preset
(see `.spec/features/shadcn-only-ui.md`), never by editing `index.css`.

The root ThemeProvider defaults to light; next-themes stores explicit light/dark
selection under its `theme` storage key and toggles the preset's `.dark` tokens.
`ThemeToggle` names the next mode and waits for mount before enabling itself.

Style screens with shadcn components from `packages/ui` plus Tailwind utility
classes on them. No custom CSS and no custom colour tokens. Component sizes, radii
and touch targets are the preset's (the old forced 44px minimum heights were
dropped). The old global `prefers-reduced-motion` override was dropped with the
custom CSS. Do not rely on colour alone for status or selected navigation.

## Shell and responsive navigation

`AppShell` owns the skip link, `Header` and, for signed-in users, the shadcn
`SidebarProvider` / `Sidebar` (`AppNavigation`). Individual screens own their main
landmark. Public visitors and loading sessions get no sidebar. Home has one Create
account action in its content; header/home authentication actions use Sign in.

| Width | Sidebar | Trigger |
| --- | --- | --- |
| >=768px | Off-canvas collapsible rail (`Sidebar`, default `collapsible="offcanvas"`) | `SidebarTrigger` in the top bar, or Cmd/Ctrl+B |
| <768px | Same content in a `Sheet`; closes when a link or chooser button is used | `SidebarTrigger` ("Toggle Sidebar") in the top bar |

There is no bottom tab bar; every former bottom-bar/More entry (Home, Estates,
Invitations, Settings, Admin users, chooser entries, resident reporting) is a
sidebar link or button. The sticky top bar holds the trigger, brand, theme switch
and circular profile menu (Settings, Sign out); it has no estate selector.
On estate pages the sidebar's second group holds the estate switcher and the
permission-filtered local links; below 768px `EstateNavigation` also shows the
switcher and the section dropdown above the page. Selected links are
`SidebarMenuButton isActive` plus `aria-current="page"`. Exact router matching
ignores filter search parameters; explicit destination state keeps Assets on
nested asset screens and Overview on section anchors such as #locations.

The skip link is an `<a href="#main-content">` styled with `buttonVariants` and
`sr-only focus:not-sr-only focus:fixed ...`; it is the first focusable element.

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

- `PageLayout` (`page-layout.tsx`): the `<main>` wrapper every screen uses -
  `mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8`; pass `className`
  (e.g. `max-w-3xl` for editors, `space-y-6`), merged with `cn`.
- `DetailCard` (`detail-card.tsx`): a `Card` > `CardContent` > `dl` in a two-column
  Tailwind grid at `sm`, for definition-list metadata.
- `PageHeader` breadcrumbs use shadcn `Breadcrumb` / `BreadcrumbList` /
  `BreadcrumbItem` / `BreadcrumbLink` (rendering the router `Link`) /
  `BreadcrumbSeparator`. The current item is a plain `span aria-current="page"`,
  because the stock `BreadcrumbPage` claims `role="link"`.
- `BackLink` (`back-link.tsx`): the single "Back to …" link above a page's
  `PageHeader`. A router `Link` styled `buttonVariants({ variant: "ghost", size: "sm" })`
  with an `aria-hidden` lucide `ArrowLeft`, muted text that turns foreground on
  hover, `-ml-2.5` so the arrow aligns with the title and `mb-2`. `to`/`params`
  are typed via `ValidateLinkOptions`; the label is `children` and is the
  accessible name. Each page has exactly one, to its nearest parent: estate
  details/editor -> Estates ("Back to estates"); council, asset register ->
  estate ("Back to estate"); asset details and asset creation -> register
  ("Back to assets"); asset edit, readings, new/replace device -> asset
  ("Back to asset"); the work-order-from-inspection status screens -> the
  inspection ("Back to inspection"). Breadcrumbs stay alongside: they show the
  full trail, the back link is the primary one-step return.

Independent sections and forms sit in `Card` > `CardContent` (outer margins on the
Card, the section/form element and its heading inside). Avoid wrapping every
field in a card. Action groups use `flex flex-wrap items-center gap-3`.

Example:

```tsx
import { Card, CardContent } from "@proj/ui/components/card";
import { FormActions } from "@/components/form-actions";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";

<PageLayout className="max-w-3xl">
  <PageHeader title="Edit estate" breadcrumbs={[
    { label: "Estates", to: "/estates" }, { label: "Edit estate" },
  ]} />
  <Card className="mt-6">
    <CardContent>
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {/* shadcn labelled fields and validation */}
        <FormActions label="Save changes" pending={pending} onCancel={cancel} />
      </form>
    </CardContent>
  </Card>
</PageLayout>
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

`LifecycleStatusBadge` and `ConditionBadge` use stock `Badge` variants only, with
the state in visible text: Active `default`, Inactive/Retired `destructive`;
Good `default`, Needs attention `secondary`, Faulty `destructive`, Not assessed yet
`outline`. `DeviceStatusBadge` already used stock variants.
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

Automated tests cover navigation context/capabilities, selected links, the mobile sidebar sheet, the skip link,
theme storage, profile-menu Settings/sign-out navigation, headers, form cancellation/pending behavior, table accessibility,
missing-page recovery and retained estate/invitation/asset/admin workflows. Tests
were observed failing before the new behavior was implemented. jsdom does not
prove responsive geometry, real focus restoration or browser contrast.

Manual acceptance remains: 360px phone, 768px tablet, 1280–1440px desktop and
200% zoom, both themes; long estate names/emails/paths; mobile cards and desktop tables/sidebar;
keyboard-only navigation/sidebar sheet/dialogs; short dialog viewports/mobile keyboard; theme persistence after refresh; owner/delegate/
member/admin visibility. Keep ID-93 pending this visual review.

## Responsive estate lists

At widths below 768px, estate/asset readings, documents and work orders use
compact shadcn Card records with labelled details. At >=768px they retain
semantic tables. The existing `lib/use-mobile.ts` media-query subscription
selects one presentation at a time; resizing does not fetch another dataset or
reset filters/paging, and hidden duplicate actions are not mounted.

Reading cards put metric/value first, retain Manual/Sensor provenance and
recorder names, measured time, applicable asset/device labels and wrapping
suspect badges. Document cards retain filename/type/size/time and the same
permission-controlled actions/dialogs as desktop. Work-order cards retain
reference links, description, priority/status/category/creation time; a shadcn
Select and direction Button provide the same sort choices as desktop headers.
Long labels wrap and controls reserve touch-friendly heights. Pagination and
page-local actions wrap within the available width. Other screens retain their
existing responsive layouts.

Resident reporting follows the selected estate rather than the account's other
memberships. Resident contexts use My reports / Report a fault in their local
section menu; staff contexts hide those actions. Global reporting asks which
estate when multiple eligible resident assignments exist. See [shell.md](shell.md).
