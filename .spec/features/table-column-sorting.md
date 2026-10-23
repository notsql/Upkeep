# Work-order and asset column sorting

**Status:** implemented and verified 2026-10-23; ready for manual review

The user approved implementing the column sorting described in the conversation
for the current work-order and asset registers. Sorting retains matching records;
existing filters independently narrow them. No status workflow or schema changes.

## Behaviour

- Work orders: sortable Reference, Category, Priority and Created headers.
  Reference follows the numeric W sequence, including beyond 9999 and estate-code
  changes. Category sorts by its displayed label. Priority uses Low < Medium <
  High < Urgent. Created sorts by timestamp. First selection is descending for
  Priority/Created, ascending for Reference/Category; subsequent clicks reverse.
  Default remains Created descending. Description and the OPEN-only status are
  static headers; additional status handling remains ID-38.
- Apply ordering on the server after estate authorization/filtering and before
  keyset pagination. Equal keys use UUID in the selected direction. Cursors bind
  to sort/direction and remain estate-scoped; invalid or mismatched cursors return
  400. Accept the existing timestamp/UUID cursor for default Created descending.
- Add optional typed `sortBy: CREATED_AT | REFERENCE | CATEGORY | PRIORITY` and
  `direction: ASC | DESC` to GET work-orders; defaults CREATED_AT/DESC. Regenerate
  the contract. Sorting resets the cursor, preserves priority/reference filters,
  is included in query keys, and survives pagination/refresh/browser history.
  Applying/clearing filters preserves the selected ordering.
- Asset register returns the complete filtered array, so order that array in the
  web app without adding API parameters. Sort Reference, Name, Category and
  Location naturally/case-insensitively using displayed values. References such
  as A0002 precede A0010. Condition uses Good < Needs attention < Faulty with
  unassessed last in both directions; first selection shows worst first. Status
  uses Active before Retired; reverse is supported. Default Reference ascending.
  Resolve ties by reference then ID. Preserve input arrays and existing filters.
- Store asset sort/direction in URL search as presentation state, not API filters.
  Provide the same choices through a labelled mobile Sort by control and reverse
  button, since asset cards have no table headers.
- Header buttons are shadcn Buttons, keyboard accessible, show direction icons
  and expose aria-sort on the column header. Use a small shared header component
  for both registers. Existing screens already use folder routes and shadcn.
- Review fix: sorting preserves the current scroll position. Work-order sort
  reloads retain same-user/same-estate rows while loading, mark the table busy
  and disable pagination until its new cursor arrives; normal filters/navigation
  retain their existing scroll behavior.

## Tests and delivery

Observe failing server tests for work-order ordering in both directions, priority
ranking, reference sequence growth, ties, pagination, combined filters, cursor
validation and estate isolation. Observe failing UI tests for header toggles,
URL/filter preservation, aria-sort and asset ordering/mobile controls. Then
implement and regenerate the API, update the existing work-order/asset docs,
run formatting, type checks, the complete test suite and production web build.
Leave all changes uncommitted; the human makes commits.

Verification passed: 871 backend tests and 527 web tests in the full clean,
uncached run; workspace type checks, formatting and the production web build.
The standard offline API export still lacks its cached Maven plugin, so the
contract was exported from Spring's live `/v3/api-docs` and TypeScript regenerated
through the installed Nx target. No dependencies or database migrations added.
