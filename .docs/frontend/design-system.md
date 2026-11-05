# Dashboard design conventions

ID-93 implementation on `feat/ui-redesign`, incorporating the council-invitation
and asset-retirement features now merged into main. The UI uses existing shadcn
components from `packages/ui`, lucide icons,
Tailwind and next-themes. No new package or database setting is needed.

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

`AppShell` owns the skip link, `Header` and, on sidebar routes, the shadcn
`SidebarProvider` / `Sidebar` (`AppNavigation`). Individual screens own their main
landmark. Public visitors and loading sessions get no sidebar. Home has one Create
account action in its content; header/home authentication actions use Sign in.

The sticky header: `SidebarTrigger` (sidebar routes, mobile only), "UpKeep"
brand -> `/` and "/" (omitted on desktop sidebar routes, where the brand tops the
sidebar), the estate switcher (current estate name +
role, or "Select estate" outside an estate), then `ThemeToggle` and the circular
account menu (Account settings, Admin users for platform admins, Sign out).

The sidebar appears only in estate scope (`/estates/$estateId/**`) and on the
resident pages; it holds no switcher and no global links. Estate groups: Overview
(unlabelled); Operations (Work orders, Fault reports, Inspections); Assets
(Locations, Assets, Devices, Readings, Device monitoring, Failure risk); Records
(Documents); Administration (Members, Roles, Asset categories, Estate settings).
Each item is filtered by its `lib/estate-destinations.ts` predicate and empty
groups are omitted. Residents get one group: Dashboard (resident-only accounts),
Report a fault, My reports. Details in [shell.md](shell.md).

| Width | Sidebar | Trigger |
| --- | --- | --- |
| >=768px | Always open (provider held open; no collapse) | None |
| <768px | Same content in a `Sheet`; closes when a link is followed | `SidebarTrigger` ("Toggle Sidebar") in the header |

There is no bottom tab bar and no separate mobile section menu. Selected links
are `SidebarMenuButton isActive` plus `aria-current="page"`; the section whose
route prefixes the pathname stays active on nested pages (Overview: exact
match). Matching ignores search parameters.

The skip link is an `<a href="#main-content">` styled with `buttonVariants` and
`sr-only focus:not-sr-only focus:fixed ...`; it is the first focusable element.

## Pages, actions and forms

Shared app pieces live in `apps/web/src/components/`:

- `PageHeader`: title, optional description/status, breadcrumbs, contextual
  actions (right-aligned `actions`; the page's primary action goes there).
  Breadcrumb `to` is a union of `/estates`, `/reports`,
  `/estates/$estateId/{assets,readings,work-orders,reports}` and
  `/estates/$estateId/assets/$assetId` (no `/`), with optional `params` and
  `search` (`{ estateId? }`, used by resident crumbs).
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

### Page header convention

- There is no `BackLink` (deleted); no page renders a "Back to …" link.
- The estate overview and top-level sections (one segment under the estate:
  work-orders, reports, inspections, assets, devices, readings, sensors,
  failure-risk, documents, council, roles, asset-categories, edit) render **no
  breadcrumbs**; the sidebar shows where you are.
- Pages two or more levels deep render breadcrumbs that start at the section
  and use loaded names, never "Estate": `Assets › Pump A › Edit`,
  `Work orders › WO-12`, `Fault reports › <report title>`,
  `Readings › Record manual reading`. While loading, the record crumb shows a stable
  fallback ("Asset", "Work order").
- Outside an estate: `/estates/new` shows `Estates › Create estate`;
  `/estates`, `/account` and `/admin/users` show none. Resident report detail
  shows `My reports › <title>` (heading stays "Report details").
- The two dead-end work-order-from-inspection screens (inspection already has
  a work order; inspection did not fail) show an outline "View inspection" link
  to the source inspection instead of a back link.

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
  <PageHeader title="Create estate" breadcrumbs={[
    { label: "Estates", to: "/estates" }, { label: "Create estate" },
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
Details sections retain meaningful headings and history dates. Loading and empty
results follow [Screen states](#screen-states-empty-loading-filters-tabs) below.
Failures use Alert + Retry. Other
features retain their labelled alerts and existing retry actions. In-app and email
invitation feedback remain distinct. Success uses the existing Sonner toasts and
query invalidation. Known internal SQL/exception messages in 5xx estate-family errors receive a
generic retry message. Existing actionable messages such as invitation-verification
failures are preserved; 401 explains sign-in verification.

## Screen states: empty, loading, filters, tabs

Every list, table or section renders one of four states with the same shared
pieces. Do not hand-roll "Loading…" paragraphs, `<p>No … yet.</p>`, raw `Empty`
markup or bespoke filter rows.

### Page header

`PageHeader` is the only page header. Each screen renders exactly one, first
inside `PageLayout`; the primary create action goes in `actions` (primary
Button/Link with a lucide `Plus`). Sections inside a page use `Card` +
`CardHeader`/`CardTitle` with an `h2`, never a second `h1`.

### Empty: `EmptyState` (`components/empty-state.tsx`)

Props: `title: string`, `description?: ReactNode`, `icon?: LucideIcon`,
`action?: ReactNode`. Renders shadcn `Empty` as a dashed card
(`bg-card border border-dashed`) with `role="status"`.

- No data and the user can create: `action` is the primary create action
  (same label as the header action, e.g. "New work order"). Without create
  permission: omit `action`.
- Filters produced no results: title "No matching …", `action` is an outline
  "Clear filters" Button.
- Inside a Card section (asset documents, work-order corrections) use it as-is;
  the dashed card nests fine. Picker/combobox "no matches" lines inside dialogs
  and `ComboboxEmpty` stay plain text - they are not page states.

```tsx
<EmptyState
  action={canCreate ? (
    <Link className={buttonVariants()} params={{ estateId }} to="/estates/$estateId/work-orders/new">
      <Plus aria-hidden="true" /> New work order
    </Link>
  ) : undefined}
  description="Saved work orders will appear here."
  icon={Wrench}
  title="No work orders yet"
/>
```

### Loading: `LoadingState` (`components/loading-state.tsx`)

Props: `label: string` (e.g. "Loading work orders…"), `variant?: "list" |
"table" | "cards"` (default `list`), `rows?: number` (default 3). Renders
`role="status" aria-busy="true"` named by `label`, with decorative shadcn
`Skeleton` rows shaped like the content: `cards` = the estates-style card grid,
`table` = bordered row lines, `list` = stacked compact cards.

Why skeletons: they hold the layout so content does not jump when data
arrives, the estates list already used them, and one component keeps the
announcement consistent. `Loader` (spinner) is kept only for the router's
`defaultPendingComponent` and whole-screen auth/session waits; `Spinner`
inside a Button is fine for pending mutations. Use `LoadingState` for every
query-driven region, including access/permission checks before a page renders
(`variant="list" rows={2}`).

```tsx
if (workOrders.isPending) {
  return <LoadingState label="Loading work orders…" variant="table" />;
}
```

### Filters: `FilterBar` (`components/filter-bar.tsx`)

Props: `label: string` (accessible name of the `search` landmark),
`search?: ReactNode`, `children?: ReactNode` (filter fields), `actions?:
ReactNode` (Clear filters, result count). Stacks below 640px; above it the
search grows (`min-w-64 flex-1`), filters wrap, actions sit at the end.

Sizing rules (the stock `SelectTrigger` is `w-fit`, so set widths):

- Each filter field: `Field className="w-full sm:w-48"` and
  `SelectTrigger className="w-full"`. Date inputs the same width.
- Selects in forms and dialogs (role pickers, type, unit): always
  `SelectTrigger className="w-full"`.
- Mobile "Filters" dialogs (assets) keep their dialog; its trigger button goes
  in `children`.

```tsx
<FilterBar
  actions={filtered ? <Button onClick={clear} variant="ghost">Clear filters</Button> : null}
  label="Filter work orders"
  search={<Field><FieldLabel htmlFor={id}>Search</FieldLabel><Input id={id} type="search" /></Field>}
>
  <Field className="w-full sm:w-48">{/* label + Select with w-full trigger */}</Field>
</FilterBar>
```

### Lists and tables

Results below the FilterBar: shadcn `Table` at >=768px, Card records below
(see Tables and feedback). Order of states: `LoadingState` -> Alert + Retry ->
`EmptyState` -> results. Pagination sits after the results.

### Tabs

Use shadcn `Tabs` (`@proj/ui/components/tabs`) when a page has distinct
sub-views of the same subject that are not needed at once, and in place of
`aria-pressed` toggle-button groups that switch between whole views. Keep
filters that narrow one list in the FilterBar. Put the active tab in the URL
search params when the screen already uses search params.

## Adding a screen and reviewing this change

Place routes in directories with adjacent `-components/` for route-local UI.
Use the shared shell/header/tokens, existing shadcn components and generated API
hooks. Fetch no private data before session readiness. Preserve current permission
checks, query keys and invalidations; visual work does not extend authorization.

Automated tests cover navigation context/capabilities, selected links, the mobile sidebar sheet, the skip link,
theme storage, account-menu Account settings/Admin users/sign-out navigation, headers, form cancellation/pending behavior, table accessibility,
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
memberships. Resident contexts use the resident sidebar (Dashboard / Report a
fault / My reports); staff contexts hide those actions. With several resident
estates, the header switcher picks the estate. See [shell.md](shell.md).
