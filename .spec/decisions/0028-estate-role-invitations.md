# 0028 - Estate Managers invite preset roles and preserve ownership

**Status:** accepted (2026-10-18)
**Supersedes:** invitation delegation/owner-only administration in ADR 0020/0022,
inviter revocation behavior in ADR 0024, and single-estate resident restriction
in ADR 0027 (EstateUser resident authority). Historical decisions remain intact.

## Context

The user agreed four estate roles, Manager/Admin equivalence, Manager-only
invitations, protected ownership and multi-estate residents. They subsequently
deferred existing-account migration and limited staff report editing to location
under the separate fault-report-locations feature. Asset editing is outside this work.

## Decision

- Store the selected MANAGER, COUNCIL, RESIDENT or CREW role on the local
  invitation before dispatch. Backfill old offers to COUNCIL; omitted role keeps
  that default, while explicit null/unknown/OWNER/ADMIN/MEMBER is invalid.
- Resolve invitation/member administration from current target-estate Manager
  membership or ownership. WorkOS supplies identity and delivery, not role
  authority. Retire non-manager delegation and deny global provider-role/grant
  endpoints so they cannot bypass invitations or estate scope.
- Keep the unique estate/email attempt, original-role/sender retry semantics,
  new delivery UUIDs for replacement attempts, verified-recipient checks and
  explicit in-app acceptance. Never convert an existing membership on acceptance.
- Manager removal/demotion withdraws their outstanding invitations; accepted
  recipients retain independent memberships. Recheck under consistent
  invitation-before-estate locks so late dispatch/acceptance cannot restore access.
- A Manager cannot remove/demote themselves. Another same-estate Manager may
  act, but the current owner must transfer first. Ownership stays a single
  Estate.ownerUserId relationship; transfer is atomic and requires another
  existing Manager in the estate. It preserves the former owner's Manager access
  and never adds/promotes the recipient.
- Allow Resident membership in several estates. Return assignment collections
  and require explicit estate selection/validation for reporting and locations.
- Make /invitations reachable by every authenticated identity. Retain PKCE/state
  and both existing delivery flows; never accept by listing offers.
- Do not inventory, import or reclassify existing accounts. Required schema
  changes and an explicit ownership-transfer transaction are not a bulk account
  migration. Custom role authoring and broader asset/report operations stay separate.

## Consequences

Prisma owns the new column/checks and removal of global resident uniqueness;
jOOQ and API types are regenerated. The existing Council URLs/capability field
names remain for compatibility. Legacy delegation/global role definitions may
remain in the generated contract but their endpoints cannot grant authority.
Existing owners without member rows retain ownership-derived Manager authority;
explicit transfer must retain that access as a Manager membership.

No new email provider, credential, dependency, platform-admin role or ownership
role is introduced. Initial account provisioning remains deferred with migration.
