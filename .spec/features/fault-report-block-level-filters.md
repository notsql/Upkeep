# Fault report block and level-position filters

**Status:** built and verified; implementation requested by the user on 2026-10-19
**Owner:** unassigned

## Problem

The responder report list has one location-tree dropdown. Managers need to find
a named block quickly and filter reports by numeric level position independently
of the level's display name.

## Behaviour

- Replace the list's Location dropdown with a searchable Block combobox and a
  Level position range (minimum and maximum numeric inputs). All blocks and
  unbounded positions are the defaults. Managers and Crew share this screen.
- Block choices display names and retain IDs as values, including inactive
  blocks for historical reads. Searching does not change the saved selection.
- Range bounds are inclusive integers, including zero and negative positions,
  and use LEVEL.sortOrder without parsing names. Either bound may be omitted.
- Block and range filters intersect. Without a block, the range applies across
  the estate. Matching levels and their common areas are included. Common areas
  directly beneath blocks match block-only filters but not a position range.
- Inactive locations and estates remain readable under existing authorization.
- Apply both filters before cursor pagination. Preserve newest-first ordering.
- Store filters in URL search state and user-scoped React Query keys. Changing
  or clearing filters clears the cursor; refresh/back/next retain the filters.
- Reject noninteger/out-of-range bounds and minimum greater than maximum. Empty
  valid results show a no-matches message; clearing restores the unfiltered list.
- Keep the existing API locationId subtree filter for compatibility. When
  combined with the new filters, all restrictions intersect. The replacement UI
  uses blockId and position bounds.

## Data

Use existing IssueReport.locationId and Location type, parentId, estateId and
sortOrder. No Prisma schema change, migration or new dependency.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/reports | Existing locationId/cursor/limit plus optional blockId: UUID, minLevelPosition: int32, maxLevelPosition: int32 | Existing IssueReportPageResponse | Current estate MANAGER or CREW |

Invalid bounds or a same-estate non-block blockId return 400. Unknown/foreign
block IDs return 404. Existing 401/403/404 authorization semantics remain.

## Edge cases

- A level named "Level 99" at position -1 matches -1, not 99.
- Block-only filtering includes direct block common areas and inactive history.
- Multiple blocks can have levels at the same position; optional blockId narrows
  the result without leaking another estate's reports.
- Equal bounds select one position; open-ended bounds and empty blocks work.
- Invalid URL bounds show an error rather than silently broadening the query.
- Report relocation continues to invalidate all filtered estate report lists.

## Out of scope

- Submission confirmation emails or other notifications.
- Changes to submission, correction, authorization, location naming or storage.
- Database indexes without evidence of a query-performance problem.

## Verification

- New API and screen tests were run and observed failing before implementation.
- Fault-report integration suite: 61 tests passed, including 10 new filter cases.
- Focused report-list screen suites: 36 tests passed.
- `pnpm api:generate`, `pnpm check-types`, `pnpm fix`, and the full
  `pnpm test --skip-nx-cache` completed successfully. Tests used existing cached
  dependencies and Testcontainers Postgres; no dependency or schema changes.
