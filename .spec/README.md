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
| [crew-work-orders-read-only.md](features/crew-work-orders-read-only.md) | - | built and verified 2026-10-26; Crew work-order reads retained and creation/writes denied; tests first, 1,354 backend and 754 web tests, type checks and formatting passed |
| [work-order-document-association.md](features/work-order-document-association.md) | ID-26 | link/change/remove, audit and attachments implemented on ID-22 PR #37 base; automated, isolated live and real Neon/R2 checks passed; database/bucket cleanup coordination and ID-23/24/25 integration pending |
| [create-inspection-results.md](features/create-inspection-results.md) | ID-36 / ID-49 integration | recording and asset inspection-history table implemented 2026-10-26; all 26 table tests, 722 web tests, 1,329 Java tests, type checks, formatting and web build pass; real-browser checks remain manual; monthly due-list generation remains separate |
| [invoice-service-report-uploads.md](features/invoice-service-report-uploads.md) | - | test-first suites written; Docker restored, 77 integration cases ran (5 passed, 68 failures, 4 missing-field errors); permission/UI failures observed; one file/submission, 5 MB/file, filename search, uploader-or-Manager deletion and VIEW_DOCUMENTS/EDIT_DOCUMENTS planned; implementation not started |
| [work-order-review-follow-ups.md](features/work-order-review-follow-ups.md) | ID-38 / ID-40 manual review | implemented and verified 2026-10-24; conflict recovery, audited corrections, oldest priority ties, member table/pagination |
| [work-order-progress-and-completion.md](features/work-order-progress-and-completion.md) | ID-38 / ID-40 | independent scope implemented 2026-10-24; live QA follow-ups verified; provider integration pending |
| [table-column-sorting.md](features/table-column-sorting.md) | ID-36 / asset register review | built and verified 2026-10-23; sortable existing columns, filters retained |
| [create-work-order.md](features/create-work-order.md) | ID-36 | implemented 2026-10-22; ready for manual review; saved inspection links deferred until inspection feature is ready |

| [custom-estate-role-creation.md](features/custom-estate-role-creation.md) | - | draft; nine permission codes/prerequisites confirmed; custom roles including Manager-only deletion blocked by assigned members/pending invitations, protected presets, delegated invitations, seeded Permission catalogue and typed jOOQ planned; preset-role target matrix recorded, broader CRUD separate; full design awaiting review |
| [typed-jooq-repositories.md](features/typed-jooq-repositories.md) | - | built; typed asset, dashboard and estate-report queries; 821 server and 461 web tests passed |
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
| [suspect-readings.md](features/suspect-readings.md) | ID-67 | built |
| [ui-redesign.md](features/ui-redesign.md) | ID-93 | implemented; current iteration accepted by user; Git merge/PR review pending |
| [portfolio-home-and-estate-directory.md](features/portfolio-home-and-estate-directory.md) | ID-93 follow-up | implemented; current iteration accepted by user; Git merge/PR review pending |
| [equipment-fault-work-orders.md](features/equipment-fault-work-orders.md) | ID-70 | implemented on feat/id-70-report-routing; tests pass; migration not yet on Neon dev; model evaluation and secrets outstanding |

Draft specs carry an **Implementation phases** checklist. Build them in the
order listed, test-first, and tick the boxes as you go. New specs start from
`features/TEMPLATE.md`.

## Why this folder starts with a dot

`.spec/` sorts alongside the other project-configuration directories (`.vscode`,
`.claude`) rather than in the middle of the source tree. It is ordinary tracked
content, not generated or ignored - some tools hide dot-directories by default,
so use `ls -a` and check your editor's explorer settings if it seems missing.
