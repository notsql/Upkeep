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
| [manager-account-authorization.md](features/manager-account-authorization.md) | ID-21 | invitations verified; broader estate roles are follow-up |
| `estate-management.md` | - | built |
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
