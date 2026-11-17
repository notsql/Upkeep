# 0056 - Fault reports from estate members only

**Status:** accepted 2026-11-18. Supersedes [0053](0053-fault-reports-from-any-signed-in-user.md).
Spec: `.spec/features/estate-role-permissions.md`.

## Context

Decision 0053 let any signed-in user search every active estate by name and
file a report there. The agreed role policy (2026-11-17) allows fault reporting
only in estates the user belongs to, whatever their role. A user with no estate
can create one, but cannot report until they belong to an estate.

## Decision

- `GET /resident/context` lists every active estate where the caller has a
  membership row of any role (Resident, Manager, Council, Crew or custom) or is
  the owner. `canSubmit` is `true` exactly when that list is not empty.
- `POST /resident/reports`, `POST /resident/reports/image-slots` and
  `GET /resident/locations` return `404 Estate not found.` for an estate the
  caller does not belong to, as for an unknown or deactivated one.
- `GET /resident/estates` (search any estate by name) is removed, and
  `SecurityConfig` no longer admits the path.
- The report form's estate picker is a `Select` of the context estates. A user
  with no estate sees "You need to be invited to an estate before you can report
  a fault." instead of the form.
- Reporting still grants no rights in the estate. History stays keyed on the
  submitter, so reports filed under 0053 remain readable by whoever filed them.

## Consequences

People who are not yet invited, and staff of other estates, can no longer report
a fault they can see; they must be invited first. Estate names are no longer
enumerable 20 at a time by any signed-in user.
