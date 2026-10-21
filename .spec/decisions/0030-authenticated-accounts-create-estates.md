# 0030 - Any authenticated account can create an estate

**Status:** accepted (2026-10-20)
**Updates:** creation eligibility/provisioning policy associated with ADR 0028
and the estate-role-invitations feature. Existing decisions remain historical.

## Context

Restricting creation to existing owners or Managers prevents an unassigned
account from creating its first estate. The user agreed self-service creation
for every account, with existing estate permissions preserved.

## Decision

- Require a valid authenticated subject for `POST /estates`, independently of
  current memberships and WorkOS role claims. Project `canCreateEstate=true`
  for authenticated accounts, while retaining estate-derived `canEnterWorkspace`.
- Reuse the existing transaction that records `Estate.ownerUserId` and the
  creator's MANAGER membership. Grant authority only in the new estate.
- Permit signed-in directory/creation routes before the workspace gate,
  including trailing slashes. Preserve guards on individual estate routes.
- Refresh access before opening the new estate. A failed refresh retains the
  successful creation and retries access/navigation without another POST.

## Consequences

No schema migration, global Manager role, account import or WorkOS role change
is needed. Resident, Crew and Council assignments elsewhere remain effective.
Creation no longer needs a trusted Manager-provisioning step. Other estate
operations retain their existing permissions; approval and quotas are outside
this change. See [the feature spec](../features/self-service-estate-creation.md).
