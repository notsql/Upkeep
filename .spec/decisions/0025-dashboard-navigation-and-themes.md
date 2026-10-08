# 0025 - Shared dashboard shell and responsive navigation

**Status:** accepted (2026-10-08), ID-93

## Decision

Use a 240px desktop sidebar from 768px and a fixed Home / Estates / More mobile
bottom app bar below that breakpoint. Desktop navigation includes permitted
Admin users and estate Overview / Assets / Council; Locations is within Overview.
Mobile estate pages have a separate row of permitted Overview / Assets / Council
links. More contains Settings and allowed Admin users. Account settings/sign-out
are also in the circular profile menu. Use routed links and existing capabilities.
Remove current-estate controls from the header; route, breadcrumbs, page headings
and sidebar convey context. The user approved contextual switching on 2026-10-09:
replace the desktop sidebar's estate heading with an accessible-estates menu and
place the same control above mobile estate links. Switching opens Overview with
the selected estate's capabilities, without carrying asset IDs/filters/anchors.
Reuse the account-scoped estate list; no browser-stored selection is needed.
Estates remains the searchable directory and creation/management destination.

Default to light with navy actions/teal accents, preserve explicit light/dark
selection using the existing next-themes provider, and style every local screen
using semantic tokens. Share PageHeader and FormActions for repeated patterns;
keep business forms and API hooks in their features.

## Rationale and consequences

The user chose dashboard navigation and a mobile bottom bar. Existing shadcn,
Base UI and lucide cover the required controls without installing a Sidebar,
Sheet or theme package. A URL-based estate context keeps nested navigation
unambiguous; role/capability gates preserve current access boundaries.

Council and retirement dependencies have now merged into main. The UI branch
retains their reviewed behaviour and uses its confirmed child database; UI work
adds no migrations and does not deploy to shared main/dev.

The user approved the refinement plan on 2026-10-08. Mobile cards replace wide
Assets/Admin Users tables while desktop tables remain. Use one responsive result
view with a stable SSR snapshot and existing query data. Long estate/asset/device
forms use dedicated pages, short location/assessment tasks use existing Dialogs,
and email invitations stay inline. These choices reduce phone scrolling and keep
long forms readable without a new drawer/tab dependency. Signed-in Home uses
a portfolio summary endpoint and compact invitations; Estates remains the searchable
directory. The agreed read-only aggregation uses existing tables and preserves
owner-only asset scope. One SQL statement supplies consistent totals without
loading full asset lists into the browser; no migration or chart dependency is needed.

Token calculations and component tests supplement, but do not replace, manual
browser review of responsive layout, keyboard focus, dialogs and both themes.
See the as-built guide in `.docs/frontend/design-system.md`.
