# shadcn-only UI

**Status:** agreed (2026-11-04)
**Owner:** Ong Zheng Kai

## Problem

The web app styles itself through ~290 lines of hand-written CSS in
`apps/web/src/index.css`: a custom palette, global `[data-slot=…]` overrides
that silently restyle every shadcn component, and bespoke classes
(`page-layout`, `section-surface`, `detail-grid`, `app-sidebar`, …) used by
~63 files. The shadcn components in `packages/ui` therefore do not look or
behave like their source, re-theming means editing two places, and the two
`components.json` files disagree on style (`base-vega` in `packages/ui`,
`base-lyra` in `apps/web`). We want the look to come only from shadcn: its
preset, its components, and Tailwind utilities on those components.

## Behaviour

- Theme comes from shadcn preset `b1Z5bafVC` (style `base-vega`, menu colour
  `default-translucent`). The CLI cannot detect a framework in `packages/ui`,
  so it runs from `apps/web`:
  `pnpm dlx shadcn@latest init --preset b1Z5bafVC --reinstall --no-monorepo --force -c apps/web`.
  `apps/web/components.json`'s `ui`/`utils` aliases point into `packages/ui`,
  so components and `globals.css` are written there.
- `packages/ui/components.json` is the source of truth. `apps/web/components.json`
  exists only so the CLI can run, and its `style`, `baseColor`, `iconLibrary`,
  `menuColor`, `menuAccent` and `rtl` match `packages/ui` exactly.
- Local edits lost to `--reinstall` that are deliberate are re-applied: the
  table container's `role="region"`/`aria-label`/`tabIndex` (keyboard-scrollable
  tables) and the input-group addon focusing a textarea as well as an input.
- `apps/web/src/index.css` contains nothing but `@import "@proj/ui/globals.css";`
  (or is deleted and the root route imports the globals directly). No custom
  colour tokens, no `[data-slot]` overrides, no `@layer components` classes.
- No file under `apps/web/src` references any of the removed classes:
  `app-shell`, `app-workspace`, `app-topbar`, `topbar-controls`, `app-sidebar`,
  `brand-mark`, `sidebar-eyebrow`, `sidebar-link`, `mobile-app-bar`,
  `bottom-nav-link`, `skip-link`, `page-layout`, `page-header`, `page-title`,
  `page-description`, `page-actions`, `detail-grid`, `section-surface`,
  `form-surface`, `section-heading`, `estate-navigation`, `report-filters`,
  `profile-menu-trigger`, `lifecycle-status-badge`, `condition-badge`.
- App shell uses the shadcn `Sidebar` component (`SidebarProvider`,
  `Sidebar`, `SidebarInset`, `SidebarTrigger`, `SidebarMenu*`). Desktop:
  collapsible sidebar. Mobile: the sidebar opens as a sheet from a trigger in
  the top bar. The mobile bottom tab bar is removed. Every link it offered is
  reachable from the sidebar, and the current page is marked
  `aria-current="page"` / `isActive`.
- The skip link still exists, is the first focusable element, and becomes
  visible on focus (Tailwind `sr-only focus:not-sr-only` on a shadcn `Button`
  rendered as an anchor).
- `PageHeader` keeps its props and renders breadcrumbs with the shadcn
  `Breadcrumb` component; title/description/actions use Tailwind utilities.
- The 39 `page-layout` wrappers become one `PageLayout` component in
  `apps/web/src/components/page-layout.tsx` (Tailwind utilities only), since
  inlining the same class string 39 times invites drift.
- `section-surface` and `form-surface` become `Card` / `CardHeader` /
  `CardContent`. `detail-grid` becomes a `Card` containing a `dl` laid out
  with Tailwind grid utilities.
- `ConditionBadge`, `LifecycleStatusBadge` (and `DeviceStatusBadge` if it uses
  custom colours) map states onto stock `Badge` variants, no custom colours:
  GOOD/active → `default`, NEEDS_ATTENTION → `secondary`,
  FAULTY/inactive → `destructive`, UNASSESSED → `outline`. Label text is
  unchanged, so state is never conveyed by colour alone.
- All existing web tests pass. Tests that asserted on removed markup (e.g.
  the bottom nav) are rewritten to assert the equivalent behaviour through the
  sidebar, as a separate, visible change - not edited to fit.
- `pnpm check-types`, `pnpm test` and `pnpm check` pass.
- `.docs/frontend/design-system.md` and `.docs/frontend/shell.md` describe
  the new shell and conventions.

## Data

None.

## API

None.

## Edge cases

- `--reinstall` overwrites components in `packages/ui`. Any local edits made
  to them since they were added are lost; diff each one after the run and
  re-apply anything deliberate.
- The preset may change the icon library or base (`base` vs `radix`). If it
  does, call sites importing the old primitives' props break; fix them in this
  change.
- Signed-out users (`public-shell`) get no sidebar, same as today.
- Dark mode keeps working through `next-themes` and the preset's `.dark`
  tokens.
- Touch-target sizing previously forced by CSS (`min-height: 2.75rem`) is
  dropped; we accept the preset's sizes.

## Out of scope

- Any change to routes, data fetching, permissions or copy.
- Custom status colours (explicitly rejected in favour of stock variants).
- New screens or components beyond those needed to replace the removed CSS.
