# 0057 - Built-in roles are permission-code bundles

**Status:** accepted 2026-11-17. Amends [0032](0032-custom-estate-role-bindings-and-live-permissions.md).
Spec: `.spec/features/estate-role-permissions.md`.

## Context

Decision 0032 gave custom roles live permission codes, but kept the built-in
roles (Manager, Council, Crew, Resident) on hard-coded role-name and ownership
checks spread across the server and web app. The agreed role policy
(2026-11-17) could not be expressed that way, and the two systems drifted.

## Decision

- The catalogue grows from 11 to 26 codes (assets, costs, readings, devices,
  inspections, work orders and fault-report triage). Custom roles may be
  granted any of them, subject to `requires()` and the 0032 rule that a
  delegated author grants only codes they hold.
- Built-in roles are fixed bundles stored in `PresetRolePermission`, seeded and
  changed only by migrations, and resolved live like custom grants
  (`EstatePermissions.effective`). Resident holds none.
- The owner holds every code in their estate, whatever their membership row
  says, unless it is a same-estate Resident row (0027 still fails closed).
  Deactivating the estate and transferring ownership stay explicit owner checks.
- Member administration (changing roles, removing members, deleting custom
  roles, invitation permissions) stays Manager-only, outside the catalogue (0032).
- Every estate endpoint asks for a code (`EstatePermissions.require`: 404 for
  non-members, 403 without the code). Every `/access/context` flag is derived
  from the codes, and the web gates screens on those flags only.
- The legacy MEMBER role is converted to COUNCIL; a later contract migration
  rejects it.

## Consequences

A Manager who is not the owner can now do everything the owner can except
deactivate and transfer; Council edit assets; Crew triage reports and lose
invoices and service reports. Changing a built-in role's powers is a migration
plus its tests, not code edits across services. A new estate endpoint must name
the code it requires.
