# Fault reports from any signed-in user

**Status:** agreed
**Owner:** Ong Zheng Kai

## Problem

Only someone with a RESIDENT `EstateUser` row in an estate can report a fault
there. Visitors, new residents the council has not invited yet, and people who
manage or work in another estate see "no estate assigned" at `/reports/new`
and cannot report a fault they can see. Faults go unreported, or reach the
estate some other way that is not recorded.

Supersedes the creation rule in `resident-fault-reporting.md`,
`resident-estate-user-authorization.md` and decision 0027
(`0027-estate-user-resident-authority.md`): "RESIDENT permits report creation"
and "deleting the membership stops new submissions". That decision gets a
superseding note when this is built.

## Behaviour

Submitting

- Any signed-in user may `POST /resident/reports` for any active estate,
  whatever their memberships, including none at all.
- A user with no `EstateUser` row gets 201, not 403, for a valid submission.
- A MANAGER/MEMBER/COUNCIL/CREW of estate A may submit in estate B, and
  reporting there does not give them any rights in B.
- Submitting for a deactivated estate, or an estate ID that does not exist,
  returns 404 "Estate not found." (Today it is 403. 404 is used because the
  user no longer needs to be assigned to the estate.)
- The location must still be an active level or common area of the chosen
  estate (400 otherwise, as today).
- The title, description and image limits are unchanged (50 / 2,500 chars,
  3 images, 5 MB each).
- The submitted report has `submittedByUserId` = the caller's WorkOS `sub`,
  as today. Duplicate detection, routing and classification run as today; they
  are keyed on the estate, not the submitter.

Picking an estate

- `GET /resident/estates?q=` returns active estates whose name contains `q`
  (case-insensitive, trimmed), at most 20, ordered by name then ID.
- `q` shorter than 2 characters after trimming returns 400.
- Deactivated estates never appear.
- The response holds only the estate's ID and name.
- `GET /resident/context` still lists the caller's active RESIDENT estates,
  and `canSubmit` is `true` for every signed-in user.
- On `/reports/new` a user with assigned estates sees them listed first, and
  with exactly one it is preselected, as today.
- A user with no assigned estates sees a search box ("Find your estate")
  instead of the "no estate assigned" alert, and can pick any result.
- A user with assigned estates can also search for another estate.
- `GET /resident/locations?estateId=` returns the active locations of any
  active estate to any signed-in user, and 404 for a deactivated or unknown
  estate (instead of 403).

Reading back

- "My reports" (`GET /resident/reports`, detail and images) keeps working for
  every user: it is already keyed on `submittedByUserId` and needs no change.
- Staff estate report screens are unchanged. They do not show who submitted a
  report (no reporter field in `EstateIssueReportSummaryResponse` or
  `EstateIssueReportDetailResponse`), so a non-member reporter looks the same
  as a resident.

What still depends on RESIDENT

- `GET /access/context`'s `hasResidentMembership` and the home redirect
  (`routes/index.tsx`): a user with a RESIDENT row and no workspace still lands
  on the resident home; anyone without a workspace still lands on
  `/reports/new` (`_auth/route.tsx`).
- Resident navigation and the header estate switcher (`resident-navigation.ts`,
  `header-estate-switcher.tsx`, `estate-feature-switcher.tsx`,
  `estate-destinations.ts`) still list RESIDENT estates.
- Council invitations still create RESIDENT rows. The role simply no longer
  gates submission.

## Data

No Prisma change. `IssueReport` already stores `estateId`, `locationId` and
`submittedByUserId` with no foreign key to `EstateUser`.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/resident/estates` (new) | required `q: string` query (2+ chars after trim) | 200 `ResidentEstateResponse[]` (max 20); 400 short `q`; 401 | signed in |
| GET | `/resident/context` (changed meaning) | none | 200 `ResidentContextResponse` - same shape; `estates` = active RESIDENT estates; `canSubmit` always `true` | signed in |
| GET | `/resident/locations` (changed) | required `estateId: UUID` query | 200 `ResidentLocationResponse[]`; 404 deactivated/unknown estate; 401 | signed in |
| POST | `/resident/reports` (changed) | unchanged `multipart/form-data` (`estateId`, `title`, `description`, `locationId`, `images`) | 201 `IssueReportDetailResponse`; 400; 401; 404 deactivated/unknown estate; 413; 415; 503 | signed in |

`ResidentEstateResponse`: `id: UUID`, `name: string` (both required). Same
shape as `ResidentContextResponse.EstateLabel`; reuse that record if it reads
cleanly in the generated schema.

`canSubmit` is kept rather than removed so the contract does not break; it can
be dropped in a later contract-only PR (expand/contract, decision 0029).

`.docs/api/resident-reports.md` and `.docs/frontend/` for `/reports/new` are
updated with the change.

## Edge cases

- Estate deactivated between picking and submitting: the locked re-check in the
  create transaction (today `activeAssignment(..., lock=true)`, becomes a
  locked active-estate lookup) returns 404 and uploaded images are deleted, as
  today. The form shows "This estate is no longer taking reports."
- Location deactivated between pick and submit: 400 "The location changed.
  Reload and try again.", as today.
- Membership deleted mid-form: no longer matters; the submission succeeds.
- A user who is MANAGER of estate A reports in A: allowed (it was forbidden
  only implicitly before). The report enters A's queue like any other.
- Search with no matches: empty list, the form shows "No estates match".
- Two estates with the same name: both appear; ordered by name then ID. No
  extra detail (address) is shown - see Open questions.
- Abuse: the only gate is a WorkOS sign-in plus the input limits. Anyone who signs up can report into any estate and can
  enumerate estate names 20 at a time. Staff can already mark reports as
  duplicates; there is no "reject as spam" action.
- SSR: `/reports/new` still needs only a session; the estate search query is
  keyed by user ID and `q`.

## Out of scope

- Anonymous or public reporting (no sign-in). Considered and not chosen.
- Shareable report links or QR codes per estate/location.
- Bot checks (Cloudflare Turnstile, CAPTCHA).
- Linking a reporter to a unit or flat.
- Reporter contact fields (name, email, phone) on the report, or showing the
  reporter to staff.
- Self-service "join this estate as a resident" from the report form.
- A spam/reject status for staff.
- Per-user submission caps / rate limiting. Sign-in plus the existing input
  limits are the only guard for now.

## Open questions

- Estate picker: searchable list of all active estates (proposed) versus
  typing an estate code or ID given out by the estate. The code avoids exposing
  every estate name to any signed-in user but needs a code to be issued and
  shown somewhere.
- Should search results show more than the name (e.g. town or address) to tell
  same-named estates apart? `Estate` has no address field today that I relied
  on - confirm.
- Should staff be told the reporter is not a resident of the estate (a
  "visitor" badge)? Not proposed, as staff see no reporter today.
- Should the resident home (`hasResidentMembership`) also open to non-members
  who have submitted reports, so they can find "My reports" without the form
  page?
