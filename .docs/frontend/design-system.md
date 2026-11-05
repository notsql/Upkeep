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
  `/estates/$estateId/{assets,readings,work-orders,reports,roles,council,locations,devices,sensors,documents,inspections,failure-risk,asset-categories}` and
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
on failures. Button variants follow [Buttons](#buttons-one-variant-per-role). Destructive
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
inside `PageLayout`. Pass `icon` (a `LucideIcon`, the same one the sidebar uses
for that section) to show it in a muted tile beside the `h1`. Sections inside a
page use `Card` + `CardHeader`/`CardTitle` with an `h2`, never a second `h1`.

**Subtitle rule:** `description` never repeats the estate name (the header
bar's estate switcher already shows it) or any other context the shell shows.
Use it only for a short fragment describing the page ("Equipment in this
estate"), or omit it. Record pages may use the record's own name as the title.

### Header variants (`components/page-header.tsx`, `list-page-header.tsx`, `detail-page-header.tsx`, `form-page-header.tsx`)

Screens use one of three variants; do not assemble `PageHeader` + actions by
hand. `PageHeader` itself stays the primitive underneath (and for the odd page
that fits none, e.g. dashboards). It also takes `meta?: ReactNode`, a muted
line under the title.

| Variant | Use for | Props |
| --- | --- | --- |
| `ListPageHeader` | Top-level list pages (work orders, assets, roles, documents…) | `title`, `icon?`, `description?`, `filters?: FilterToggleProps`, `create?: CreateButtonProps`, `actions?` (extras, e.g. Export; rendered between Filters and Create) |
| `DetailPageHeader` | One record (work order, asset, report, inspection) | `breadcrumbs`, `title`, `status?` (badge), `meta?` (e.g. "Opened 3 Mar 2026 · Pump A"), `actions?` (outline Edit first, destructive last) |
| `FormPageHeader` | Create/edit pages | `breadcrumbs`, `title`, `description?`; no actions (the form footer submits) |

The "back link" on detail and form pages is the breadcrumb trail (the parent
crumb is a link); there is still no `BackLink` component (see Page header
convention).

```tsx
<ListPageHeader
  create={canCreate ? { params: { estateId }, to: "/estates/$estateId/roles/new" } : undefined}
  filters={{ activeCount, ...panel.toggleProps }}
  icon={ShieldCheck}
  title="Roles"
/>

<DetailPageHeader
  actions={<><Button variant="outline">Edit</Button><Button variant="destructive">Cancel work order</Button></>}
  breadcrumbs={[{ label: "Work orders", params: { estateId }, to: "/estates/$estateId/work-orders" }, { label: order.reference }]}
  meta={`Opened ${opened} · ${order.assetName}`}
  status={<WorkOrderStatusBadge status={order.status} />}
  title={order.reference}
/>

<FormPageHeader
  breadcrumbs={[{ label: "Estates", to: "/estates" }, { label: "Create estate" }]}
  title="Create estate"
/>
```

Breadcrumb `to` is a closed union; add a route to `Breadcrumb` in
`page-header.tsx` when a new parent needs linking.

### List-page header actions: `CreateButton`, `FilterToggle` (`components/page-actions.tsx`, `components/filter-toggle.tsx`)

Every list page puts the same actions, in the same order, in `PageHeader
actions`: `FilterToggle` (if the page has filters) then `CreateButton` (if the
user can create). Never hand-roll a create button or rename it ("New work
order", "Record manual reading"): the label is always "Create".

- `CreateButton`: either `to` (+ optional `params`, `search`; typed router
  `Link` styled with `buttonVariants()`, so it is a real link) **or**
  `onClick: () => void` (a `type="button"` Button, e.g. to open a Dialog).
  Renders a primary button with a `Plus` icon and the text "Create".
  Optional `id` lands on the button/link, so a dialog's `finalFocus` can
  return focus to it (Locations "Add block").
- `FilterToggle`: `expanded: boolean`, `controls: string` (the FilterBar's
  id), `onToggle: () => void`, `activeCount?: number`. An outline button with
  `ListFilter` and "Filters", a secondary `Badge` with the count when
  `activeCount > 0`, `aria-expanded`/`aria-controls`, and accessible name
  "Filters" or "Filters, N active". Spread `useFilterPanel(...).toggleProps`.

```tsx
import { FilterToggle } from "@/components/filter-toggle";
import { CreateButton } from "@/components/page-actions";
import { FilterBar, useFilterPanel } from "@/components/filter-bar";

const panel = useFilterPanel(activeCount);

<PageHeader
  actions={
    <>
      <FilterToggle activeCount={activeCount} {...panel.toggleProps} />
      {canCreate ? (
        <CreateButton params={{ estateId }} to="/estates/$estateId/work-orders/new" />
      ) : null}
    </>
  }
  icon={Wrench}
  title="Work orders"
/>
<FilterBar activeCount={activeCount} label="Filter work orders" onClear={clear} {...panel.barProps}>
  {/* fields */}
</FilterBar>

// Dialog-driven create:
<CreateButton onClick={() => setDialogOpen(true)} />
```

### Section titles: `SectionHeading` (`components/section-heading.tsx`)

Props: `children: ReactNode`, `icon?: LucideIcon`, `level?: 2 | 3 | 4`
(default 2), `id?: string` (for `aria-labelledby`), `className?: string`.
Renders `h{level}` (`text-lg font-semibold`) with the icon decorative
(`aria-hidden`) and muted. Use it for card and section titles, or put the same
icon + text inside `CardTitle`.

### Empty: `EmptyState` (`components/empty-state.tsx`)

Props: `title: string`, `description?: ReactNode`, `action?: ReactNode`.
Renders shadcn `Empty` (`EmptyHeader` > `EmptyTitle` + muted
`EmptyDescription`, then `EmptyContent` for the action) with `role="status"`
as a quiet panel: solid `rounded-lg border`, `px-6 py-10`, no background
change. Inside a Card's content (`data-slot="card-content"`, e.g. every
`SectionCard`) it drops the border and uses `py-6`, so it never reads as a
card-in-a-card. There is no option for this; it is automatic.

- **No icon.** EmptyState draws none and takes no `icon` prop.
- **No create button.** The page header's `CreateButton` (or the section's
  header action) is the single create entry point. When the user can create,
  the description may point at it, worded "Use Create to add the first …"
  (or the header action's label, e.g. "Use Record repair to add the first
  entry"); otherwise a neutral line ("Saved work orders appear here").
- `action` is only for recovery: an outline "Clear filters" Button when
  filters produced no results (title "No matching …"), or "Go to first page".
- Picker/combobox "no matches" lines inside dialogs and `ComboboxEmpty` stay
  plain text - they are not page states.

```tsx
<EmptyState
  description="Use Create to add the first work order"
  title="No work orders yet"
/>

<EmptyState
  action={<Button onClick={clear} variant="outline">Clear filters</Button>}
  description="Try other filters"
  title="No matching work orders"
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
announcement consistent. `RoutePending` (spinner) is kept only for the router's
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

The filter area is its own section: a muted, bordered panel
(`bg-muted/40 rounded-lg border p-3 sm:p-4`) headed by a lucide `ListFilter`
icon and a "Filters" label, visibly apart from the results below. Leave a gap
(`space-y-*` / `mt-4`) between it and the results; it sets no outer margin.

Props:

- `label: string` - accessible name of the `search` landmark.
- `search?: ReactNode` - grows to fill the row (`min-w-64 flex-1`).
- `children?: ReactNode` - filter fields.
- `actions?: ReactNode` - extras at the end of the field row (result count,
  Apply). Backward compatible: existing screens that pass "Clear filters" here
  keep working.
- `activeCount?: number` (default 0) - when above 0 the header shows an
  "N active" secondary `Badge`.
- `onClear?: () => void` - with `activeCount > 0`, the header shows a ghost
  `X` "Clear filters" button. New screens use this instead of putting Clear in
  `actions`; when migrating a screen, remove its own Clear button so it is not
  shown twice.

- `id?: string`, `open?: boolean` - make the panel **retractable** (shadcn
  `Collapsible`, `@proj/ui/components/collapsible`). Spread
  `useFilterPanel(activeCount).barProps`; the header's `FilterToggle` gets
  `toggleProps`. Without `open` the bar is always shown (old behaviour).

`useFilterPanel(activeCount: number)` returns `{ open, setOpen, toggleProps:
{ controls, expanded, onToggle }, barProps: { id, open } }`. The panel is
collapsed by default and starts expanded when `activeCount > 0` on first
render (filters arrived from the URL). When retractable, the bar drops its own
`ListFilter` icon since the toggle shows it. Every list page with filters uses
the retractable form.

Stacks below 640px; above it the fields wrap.

Sizing rules (the stock `SelectTrigger` is `w-fit`, so set widths):

- Each filter field: `Field className="w-full sm:w-48"` and
  `SelectTrigger className="w-full"`. Date pickers the same width; a
  `DateRangePicker` may take `sm:w-72`.
- Selects in forms and dialogs (role pickers, type, unit): always
  `SelectTrigger className="w-full"`.
- Mobile "Filters" dialogs (assets) keep their dialog; its trigger button goes
  in `children`.

```tsx
<FilterBar
  activeCount={activeCount}
  label="Filter work orders"
  onClear={clear}
  search={<Field><FieldLabel htmlFor={id}>Search</FieldLabel><Input id={id} type="search" /></Field>}
>
  <Field className="w-full sm:w-48">{/* label + Select with w-full trigger */}</Field>
</FilterBar>
```

### Dates and times: `DatePicker`, `DateTimePicker`, `DateRangePicker`

Never use native `<input type="date" | "datetime-local">`. Use these shared
fields, built on shadcn `Popover` + `Calendar` (`@proj/ui/components/popover`,
`@proj/ui/components/calendar`, react-day-picker). Values are the same strings
the native inputs used, so they drop into existing state and API mapping.

- `DatePicker` (`components/date-picker.tsx`): `value: string`
  (`YYYY-MM-DD`, `""` when empty), `onChange(value: string)`,
  `placeholder?` ("Pick a date"), `clearable?` (default true; shows a "Clear
  date" button in the popover), `min?`/`max?` (`YYYY-MM-DD`, days outside are
  disabled), plus trigger props `id`, `aria-label`, `aria-describedby`,
  `aria-invalid`, `disabled`, `className` (default `w-full`). The trigger is an
  outline Button with a `CalendarIcon` showing e.g. "14 Mar 2026". Label it with
  `<FieldLabel htmlFor={id}>` - the trigger is a button, so the label names it.
  Also exports `parseDateValue`, `toDateValue`, `formatDateValue`.
- `DateTimePicker` (`components/date-time-picker.tsx`): `value: string`
  (`YYYY-MM-DDTHH:mm`, as `datetime-local`), `onChange`, `placeholder?`, same
  trigger props. A DatePicker plus a `TimePicker` (group named
  "<aria-label> time", Selects "<aria-label> hour"/"<aria-label> minute"; id
  `<id>-time`). Picking a day keeps the time (00:00 if none); changing the
  time keeps the date (today if none).
- `TimePicker` (`components/time-picker.tsx`): `value: string` (`HH:mm`, `""`
  empty), `onChange(value: string)`, `minuteStep?` (default 5; an off-step
  current minute stays listed), `partLabel?` (prefix for the hour/minute
  names, defaults to `aria-label`), plus `id` (on the hour Select; minute gets
  `<id>-minute`), `aria-label` (default "Time"), `aria-describedby`,
  `aria-invalid`, `disabled`, `className`. A `role="group"` with a `Clock`
  icon and two shadcn `Select`s (hour 00-23, minute). Picking one part
  defaults the other to 00. shadcn has no TimePicker component - its "date
  and time picker" calendar blocks use a native `Input type="time"`, which is
  the browser widget - so this is built from `Select`. **Never use
  `<input type="time">`**; every time field uses `TimePicker` or
  `DateTimePicker`.
- `DateRangePicker` (`routes/_auth/estates/$estateId/assets/$assetId/-components/date-range-picker.tsx`): `value: { from:
  string; to: string }` (`YYYY-MM-DD` each, `""` unset), `onChange`,
  `placeholder?` ("Any date"), same trigger props. One outline trigger
  ("1 Mar 2026 – 31 Mar 2026", `CalendarRange` icon) opening a two-month range
  calendar with "Clear dates". For from/to filters.

```tsx
<Field className="w-full sm:w-48">
  <FieldLabel htmlFor="due">Due</FieldLabel>
  <DatePicker id="due" onChange={setDue} value={due} />
</Field>
```

## Buttons: one variant per role

Colour tells the user how important an action is, so variants follow the
action's role, not taste.

| Variant | Use for | Examples |
| --- | --- | --- |
| `default` (primary) | The **one** main action of the view: page-header create action, form submit, dialog confirm (non-destructive). At most one per view/dialog footer. | "New work order", "Save", "Create estate" |
| `outline` | Secondary actions beside the primary; Cancel; Retry in error alerts; pagination; picker/dialog triggers; export; Clear filters as an EmptyState action | "Cancel", "Retry", "Next", "Export CSV" |
| `ghost` | Row/inline and icon-only actions inside tables, cards and toolbars; FilterBar's Clear filters; dismiss | row "Edit", kebab menu |
| `destructive` | Only the confirm button of a destructive action (in its confirmation dialog), and the trigger that opens it on a details page | "Delete file", "Retire asset", "Deactivate" |
| `secondary` | Not used. Use `outline`. | - |
| `link` | Inline navigation inside text | "View inspection" in a sentence |

Rules:

- Retry is `outline`, never `default` - it is recovery, not the main task.
- Pagination is all `outline` (Previous and Next match).
- Cancel is always `outline` and sits after the primary.
- A row action that deletes opens a confirmation; the row trigger is `ghost`
  (or a menu item with `variant="destructive"`), the confirm is `destructive`.
- Links that look like buttons use `buttonVariants({ variant })` with the same
  rules.

## Copy: terse UI chrome

Labels, titles and descriptions are fragments, not sentences. No trailing full
stops in titles, labels, buttons or badges. Sentences are allowed only in
error alerts, confirmation dialog bodies (state the effect) and help text that
explains a rule.

| Element | Rule | Do | Don't |
| --- | --- | --- | --- |
| Button | Verb + noun, 1-3 words | "New work order", "Retry", "Export CSV" | "Click here to create a new work order" |
| Page description | Optional; <= ~8 words, no full stop | "Equipment in this estate" | "Every device in this estate and whether it is still reporting. Devices that have gone quiet are listed first." |
| Empty title | "No <things> yet" / "No matching <things>", no full stop | "No documents yet" | "No documents linked to this asset." |
| Empty description | Optional; one short fragment | "Uploads appear here" | "Uploaded invoices and service reports will appear here." |
| Section title | Noun phrase | "Maintenance costs" | "Here are your maintenance costs" |
| Field label | Noun, no colon | "Due date" | "Please select the due date:" |
| Loading label | "Loading <things>…" | "Loading readings…" | - |
| Pending button | Present participle + … | "Saving…" | "Please wait while we save" |

## Icons: lucide-react

Icons come from `lucide-react` only, are decorative (`aria-hidden="true"`) and
never replace a visible label (icon-only buttons need `aria-label`). Default
size is the component's (`size-4` in buttons); do not set colours except
`text-muted-foreground` for section/filter icons.

Use one per:

**Never show the same icon twice on one screen.** The section's icon appears
only in the sidebar and the `PageHeader`; empty states use the neutral
`Inbox` default (or `SearchX` for no matches); section titles use a distinct
icon or none; the filter `ListFilter` lives only on the `FilterToggle`.

- **Nav items and page headers**: the same icon for a section in the sidebar
  and in `PageHeader icon`, taken from `components/app-navigation.tsx`:
  `LayoutDashboard` overview, `Wrench` work orders, `ClipboardList` fault
  reports, `ClipboardCheck` inspections, `MapPin` locations, `Layers` assets,
  `Cpu` devices, `Activity` readings, `Gauge` device monitoring,
  `AlertTriangle` failure risk, `Files` documents, `Users` members,
  `ShieldCheck` roles, `Tags` asset categories, `Settings` estate settings,
  `Building2` estates. Pages outside that list: `UserRound` account,
  `ShieldCheck` admin users, `ClipboardPenLine` resident "Report a fault". Check
  `components/app-navigation.tsx` and reuse what it uses.
- **Primary actions**: leading icon - `Plus` create, `Save`/none for submit,
  `Upload`, `Download`, `Send`, `UserPlus`.
- **Empty states**: no `icon` prop (neutral `Inbox` default); `SearchX` for
  "No matching …".
- **Section / card titles**: `SectionHeading icon` or an icon inside
  `CardTitle`.
- **Filters**: built into `FilterToggle` (`ListFilter`).

Not on: every row action, every field, badges, pagination text buttons.

### Lists and tables

Results below the FilterBar: shadcn `Table` at >=768px, Card records below
(see Tables and feedback). Order of states: `LoadingState` -> Alert + Retry ->
`EmptyState` -> results. Pagination sits after the results.

### Shared building blocks

Use these instead of hand-rolling the pattern. Each repeats on 7+ screens.

- **`ErrorState`** (`components/error-state.tsx`): `message: string`,
  `onRetry: () => void`, `retryLabel?` (default "Retry"), `retryAriaLabel?`
  (accessible name when several Retry buttons share a screen, e.g. "Retry
  asset link for <file>" per document row). Destructive `Alert`
  (`role="alert"`, `CircleAlert` icon) with an outline Retry button. Every
  failed query renders this - not `<p role="alert">… <Button>Retry</Button></p>`.
  Mutation errors inside dialogs stay a `text-destructive` `role="alert"` line
  (ConfirmDialog/FormDialog do this via `error`).
- **`Pagination`** (`components/pagination.tsx`): `label` (nav name, e.g.
  "Work order pages"), `summary?` ("1–20 of 45"), `canPrevious`, `canNext`,
  `onPrevious`, `onNext`, `disabled?`. Outline "Previous page"/"Next page".
  The caller owns offset or cursor state. Readings keep their numbered
  `ReadingPagination`.
- **`SectionCard`** (`components/section-card.tsx`): `title`, `icon?`,
  `level?` (2), `description?`, `actions?` (header top right), `className?`,
  `children`. A `Card` holding a `section` labelled by its `SectionHeading`.
  Use for every titled card section on detail pages instead of `Card` +
  `CardHeader` + `SectionHeading` by hand. `icon` must not repeat the page icon.
- **`ConfirmDialog`** (`components/confirm-dialog.tsx`): `open`, `title`,
  `description?` (the effect), `children?` (identify the target),
  `confirmLabel`, `pendingLabel?`, `cancelLabel?` ("Cancel"; e.g. "Keep
  role"), `confirmIcon?`, `destructive?` (true), `pending?`,
  `confirmDisabled?` (keeps confirm disabled, e.g. until a typed MCST
  number / asset reference / device identifier matches), `error?`,
  `onConfirm`, `onCancel`. Locks while pending (buttons disabled, no X,
  Escape/outside ignored). For every delete/deactivate/retire confirmation,
  including the type-to-confirm ones (deactivate estate, retire asset,
  deactivate device). It is not a `<form>`: Enter in its inputs does not
  confirm.
- **`FormDialog`** (`components/form-dialog.tsx`): `open`, `title`,
  `description?`, `children` (fields), `submitLabel`, `pendingLabel?`
  ("Saving…"), `pending?`, `submitDisabled?`, `secondaryActions?` (extra
  footer buttons before Cancel, e.g. report "Reload" after a conflict),
  `className?` (on `DialogContent`, e.g. `max-h-… overflow-y-auto sm:max-w-xl`),
  `error?` (a plain `role="alert"` line; put a richer recovery `Alert` in
  `children` instead), `onSubmit: (form: HTMLFormElement) => void` (default
  prevented; read uncontrolled fields with `new FormData(form)`), `onClose`.
  A `<form>` named by the dialog title (`aria-labelledby`, so
  `getByRole("form", { name })` works) with a Cancel + submit footer;
  cannot be dismissed while pending. For short create/edit tasks (work-order
  completion, report change location, metric policy, pause sensor, upload
  document). Children must not contain another `<form>`. The documents
  asset-link and work-order-link dialogs stay hand-built `Dialog`s: they are
  multi-mode panels (read-only view, Close-only footer, destructive Unlink,
  inline editor/picker forms) with no single submit.

```tsx
{orders.isError ? <ErrorState message="Unable to load work orders" onRetry={retry} /> : null}

<Pagination canNext={!!data.nextCursor} canPrevious={index > 0} label="Work order pages" onNext={next} onPrevious={previous} />

<SectionCard actions={<Button variant="outline">Upload</Button>} title="Documents">…</SectionCard>

<ConfirmDialog
  cancelLabel="Keep role" confirmIcon={Trash2} confirmLabel="Delete role"
  description="Permanent · pending links stop working" error={deletion.error?.message}
  onCancel={close} onConfirm={confirm} open={Boolean(role)}
  pending={deletion.isPending} pendingLabel="Deleting role…" title="Delete role"
>
  <p className="font-medium">{role?.name}</p>
</ConfirmDialog>
```

Not built (too varied to share yet): a list wrapper - keep the state order
`LoadingState` -> `ErrorState` -> `EmptyState` -> results by hand; a form page
layout - use `PageLayout className="max-w-3xl"` + `Card` + `FormActions`.

### Sub-views: separate routes + `SubNav` (`components/sub-nav.tsx`)

Distinct sub-views of one subject are **separate routes**, not in-page
`Tabs`: folder-based child routes (`estates/$estateId/locations/index.tsx`
beside `estates/$estateId/index.tsx`), each its own URL, linked by a shared
`SubNav` under the `PageHeader`. Do not add new in-page `Tabs` for whole
views; keep shadcn `Tabs` only for small in-card toggles that are not
destinations. Filters that narrow one list stay in the FilterBar.

Props: `label: string` (the `nav`'s accessible name), `items: { label;
to; params?; search?; exact? }[]` (`to` typed against the route tree; set
`exact: true` on the section's index route so it is not active on children).
Renders `<nav aria-label>` > `<ul>` styled as the shadcn Tabs `line`
variant (`tabsListVariants({ variant: "line" })` plus `h-10 w-full
justify-start border-b`): a full-width row with a bottom border, not the
compact muted pill. Each item is a router `Link` styled like a line
TabsTrigger; the router sets `aria-current="page"` on the active one, which
darkens its text and shows a 2px underline over the row's border. The height
and underline are set on SubNav's own elements because there is no
`Tabs` (`group/tabs`) parent.

```tsx
<SubNav
  items={[
    { exact: true, label: "Overview", params: { estateId }, to: "/estates/$estateId" },
    { label: "Locations", params: { estateId }, to: "/estates/$estateId/locations" },
  ]}
  label="Estate sections"
/>
```

## Adding a screen and reviewing this change

Place routes in directories with adjacent `-components/` for route-local UI.
One component per `.tsx` file, named for it in kebab-case (`WorkOrderStat` ->
`work-order-stat.tsx`); a route file holds only its route component. Shared
non-component code (hooks, helpers, types) goes in a `.ts` file beside it.
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
