# Spec

The written half of this project. Code says *how*; this folder says *what* and
*why*. If a decision would take more than a paragraph to re-derive from the
code, it belongs here.

## Layout

| Path | Holds | Add one when |
| --- | --- | --- |
| `architecture.md` | How the system fits together, and the rules that keep it that way. | It changes. Keep it current - a stale architecture doc is worse than none. |
| `testing.md` | How we test, and how to work test-first. | The tooling or the testing workflow changes. |
| `decisions/` | Short records of choices we made and rejected. | You pick between real alternatives and the loser was defensible. |
| `features/` | One spec per feature: the behaviour, the API surface, the edge cases. | Before building anything bigger than a single endpoint. |

## Working agreement

- **Spec before code for anything cross-cutting.** A feature touching both the
  Java API and the web app gets a `features/` doc first, so the contract is
  agreed before either side builds against it.
- **Specs are living.** Update the doc in the same PR as the behaviour. A spec
  that lies is a bug.
- **Decisions are immutable.** Don't edit a decision to reflect a change of
  mind - add a new one that supersedes it, and link them.

## Status

- `architecture.md` and `decisions/` describe the **platform as built** and are
  current.
- `features/`:

| Spec | Jira | Status |
| --- | --- | --- |
| [management-endpoint-security-regression.md](features/management-endpoint-security-regression.md) | - | built; explicit endpoint authorization and regression tests verified |
| [resident-fault-reporting.md](features/resident-fault-reporting.md) | - | locally verified implementation; multi-estate residents and staff location-only editing follow-up planned |
| [resident-estate-user-authorization.md](features/resident-estate-user-authorization.md) | - | implemented baseline; planned role revision replaces single-estate limit and manual-only provisioning |
| [manager-account-authorization.md](features/manager-account-authorization.md) | ID-21 | invitations verified; broader estate roles are follow-up |
| [estate-role-invitations.md](features/estate-role-invitations.md) | - | implemented and verified; role invitations, owner preservation, no Manager self-removal/demotion and multi-estate residents; account migration and asset editing excluded; staff editing limited to location under fault-report-locations |
| [fault-report-locations.md](features/fault-report-locations.md) | - | draft; location display, hierarchy filters and location-only editing for Manager/Admin and Crew; other report information/images retained |
| [fault-report-block-level-filters.md](features/fault-report-block-level-filters.md) | - | built and verified; searchable block and numeric level-position range |
| [neon-role-management.md](features/neon-role-management.md) | - | invitation/member Neon authority implemented and verified; unified Manager/Admin; existing-account migration deferred |
| `estate-management.md` | - | built |
| [self-service-estate-creation.md](features/self-service-estate-creation.md) | - | built; feature tests/type checks pass; full server suite retains 13 pre-existing bulk-floor failures |
| `location-hierarchy.md` | - | built |
| `building-assets.md` | ID-46 | draft |
| `asset-location-picker.md` | ID-54 | draft |
| `asset-search.md` | ID-47 | draft |
| `failure-risk.md` | ID-32 | draft |
| [suspect-readings.md](features/suspect-readings.md) | ID-67 | draft; awaiting review |
| [ui-redesign.md](features/ui-redesign.md) | ID-93 | implemented; current iteration accepted by user; Git merge/PR review pending |
| [portfolio-home-and-estate-directory.md](features/portfolio-home-and-estate-directory.md) | ID-93 follow-up | implemented; current iteration accepted by user; Git merge/PR review pending |

Draft specs carry an **Implementation phases** checklist. Build them in the
order listed, test-first, and tick the boxes as you go. New specs start from
`features/TEMPLATE.md`.

## Why this folder starts with a dot

`.spec/` sorts alongside the other project-configuration directories (`.vscode`,
`.claude`) rather than in the middle of the source tree. It is ordinary tracked
content, not generated or ignored - some tools hide dot-directories by default,
so use `ls -a` and check your editor's explorer settings if it seems missing.
