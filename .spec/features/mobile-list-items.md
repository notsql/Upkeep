# Mobile list items instead of tables

**Status:** agreed 2026-11-10
**Owner:** Ong Zheng Kai

## Problem

On phones (<768px) every list screen renders a shadcn `Table`. Tables need
horizontal scrolling, hide columns off-screen and make each row a thin strip
that is hard to tap. The one screen that already switches (readings,
`ReadingCards`) uses a full `Card` per row, which wastes the little vertical
space a phone has.

## Behaviour

- Below 768px (`useIsMobile`), each screen listed below renders its rows as a
  **list of items** instead of a `Table`. At 768px and above the table is
  unchanged.
- The list is the shadcn `Item` component (`ItemGroup` > `Item` with
  `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`), added with
  `pnpm dlx shadcn@latest add item -c packages/ui`. Items are separated by a
  divider (`ItemSeparator`), not boxed: no `Card` per row.
- Each item shows, in this order:
  - **Title line:** the row's main name (asset name, work order title, member
    name, filename...), with its status `Badge` at the trailing edge.
  - **One or two muted description lines:** the remaining important columns
    joined with " · " (e.g. `MG-001 · Pump room · Due 12 Nov`).
  - **Actions:** the row's existing actions at the trailing edge (a
    `DropdownMenu` when there is more than one), same handlers as the table.
- A row that links to a detail page in the table makes the **whole item** the
  link (one tap target), keeping the same accessible name.
- The list is a `ul`/`li` with the same `aria-label` as the table it replaces,
  so tests and screen readers find "Assets", "Work orders" etc. either way.
- Loading, empty and error states stay exactly as they are today. Pagination,
  sorting controls and filters are shared with the table and behave the same.
- **Information hierarchy:** one thing per item is primary (the title, normal
  weight `font-medium`, foreground colour). Status sits beside it as a `Badge`.
  Everything else is secondary (`text-muted-foreground`, smaller), ordered by
  what a user scans for first; identifiers like references come before
  locations, dates last. Money or measured values that are the point of the
  row (cost total, reading value) are emphasised, not buried in the muted line.
  Never more than two description lines.
- `ReadingCards` (readings) moves from cards to the same list items.
- Cards stay only where a row genuinely needs grouped, multi-field content that
  doesn't fit two lines; none of the screens below qualify.

### Screens

| Screen | Title | Description line(s) | Trailing |
| --- | --- | --- | --- |
| Asset register | Name | Reference · Category · Location; Sensors · Risk | Status badge |
| History asset list | Name | Reference · Category · Location | Status badge |
| All sensors | Sensor | Asset · Location; Last seen | Status, Monitoring |
| When to warn (metric policies) | Measurement | Warn after | Status, actions |
| Asset documents / WO documents | Filename | Type · Size · Uploaded | Actions |
| Asset inspection history | Inspection date | Inspector · Follow-up | Outcome badge |
| Asset costs | Entry | Date | Total (SGD) |
| Grouped readings (asset) | Value + metric | Measured · Source | Flags |
| Estate readings | (as above) | | |
| Inspections checks | Asset | Category · Due · Basis | Status, action |
| Check schedules | Equipment type | Assets · Regular checks · How often | action |
| Work orders | Title | Asset · Location · Due | Status badge |
| Documents | Filename | Type · Linked to · Uploaded | Actions |
| Members | Name | Email · Role | Status, actions |
| Custom roles | Role | Permissions summary | Actions |
| Import history | Source | Uploaded · Imported | Status badge |
| Import row results | Record | Line · Issues | Outcome badge |
| Admin users | Name | Email · Role | Actions |

Pickers inside dialogs (choose asset, choose work order) and the CSV preview
are **out of scope** (see below).

## Data

None.

## API

None.

## Edge cases

- Long names/filenames wrap (`[overflow-wrap:anywhere]`), never push the badge
  off-screen.
- A column that is empty in the table is omitted from the description line,
  not shown as "-" between separators.
- Selectable rows (if any) keep their checkbox as the leading `ItemMedia`.
- Rotating a phone across 768px swaps views without losing filters, sort or
  page (state lives above the table/list switch).

## Out of scope

- Dialog pickers (`document-asset-picker`, `work-order-picker`) and the CSV
  import preview: they are short-lived and keep their tables.
- Any change to desktop tables, sorting logic or data fetching.
- A generic "table that becomes a list" abstraction: each screen renders its
  own list from the shadcn `Item` parts.
