# 0025 - Shared dashboard shell and responsive navigation

**Status:** accepted (2026-10-08), ID-93

## Decision

Use a 240px desktop sidebar from 768px and a mobile bottom app bar below that
breakpoint. Global navigation is Home / Estates / Account with admin navigation
where authorized; estate context supplies Overview / Locations / permitted
Assets and Council. Mobile More keeps secondary destinations reachable through
the existing shadcn DropdownMenu. Keep real routed links and existing API
capabilities rather than adding placeholder pages or a speculative registry.

Default to light with navy actions/teal accents, preserve explicit light/dark
selection using the existing next-themes provider, and style every local screen
using semantic tokens. Share PageHeader and FormActions for repeated patterns;
keep business forms and API hooks in their features.

## Rationale and consequences

The user chose dashboard navigation and a mobile bottom bar. Existing shadcn,
Base UI and lucide cover the required controls without installing a Sidebar,
Sheet or theme package. A URL-based estate context keeps nested navigation
unambiguous; role/capability gates preserve current access boundaries.

The UI branch integrates two pending features so their screens can be restyled
now. Those integration commits are separate from UI work and do not approve the
feature PRs or deploy to shared main/dev. The feature database contains their
existing migrations. Keep the eventual UI PR Draft until its dependencies merge.

Token calculations and component tests supplement, but do not replace, manual
browser review of responsive layout, keyboard focus, dialogs and both themes.
See the as-built guide in `.docs/frontend/design-system.md`.
