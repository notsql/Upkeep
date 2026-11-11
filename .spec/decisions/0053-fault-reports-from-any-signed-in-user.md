# 0053 - Fault reports from any signed-in user

**Status:** accepted. Partly supersedes
[0027](0027-estate-user-resident-authority.md). Spec:
`.spec/features/fault-reports-from-any-signed-in-user.md`.

## Context

Only users with a RESIDENT `EstateUser` row could report a fault in an estate.
Visitors, residents not yet invited and staff of other estates could not
report a fault they could see.

## Decision

- Any signed-in user may submit a report, request a photo slot and list
  locations for any **active** estate. Membership is not checked; an unknown
  or deactivated estate returns 404 `Estate not found.`.
- New `GET /resident/estates?q=` finds active estates by name (2+ characters,
  case-insensitive, at most 20, ID and name only) for the report form's picker.
- `GET /resident/context` keeps its shape: RESIDENT estates are listed first in
  the picker; `canSubmit` is always `true` until a later contract-only change
  removes it (expand/contract, 0029).
- Reporting grants no rights in the estate. RESIDENT still drives the home
  redirect, resident navigation and the estate switcher.
- No rate limit or bot check: WorkOS sign-in and the existing input limits are
  the only guard.

## Consequences

Any signed-in user can list estate names 20 at a time and file reports into
any estate. Staff see no reporter on a report, so a non-member's report looks
like a resident's. Report history stays keyed on the submitter.
