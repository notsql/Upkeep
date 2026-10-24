# 0032 - Custom estate roles use live same-estate definitions

Date: 2026-10-24. Accepted for implementation by the user.

## Context

Preset roles cannot express bounded estate-local report, location, invitation or
role-authoring access. JWT/provider roles are stale authorization inputs and
cross-estate templates would create authority beyond the agreed feature.

## Decision

Keep one role per EstateUser, with CUSTOM and a nullable customRoleId. Invitations
store the same selector before dispatch. Both tables have a composite restrictive
FK to EstateRoleDefinition(id, estateId) and CHECK constraints requiring a custom
reference exactly for CUSTOM. Presets retain null references and existing powers.
Permission is a persisted migration-seeded catalogue; EstateRolePermission links
to recognized codes by restrictive FK. Runtime access resolves current typed
jOOQ rows, rejects unsupported/inconsistent grants and never trusts JWT roles.

Definitions are live: editing changes current assignees and pending offers.
Optimistic versions protect editors, assignment and offered-role selection;
explicit recipient acceptance confirms the displayed current version. Provider
reconciliation accepts the latest valid definition after verifying the provider
acceptance. A delegated author can grant only own permissions, must hold both
old and new sets to edit, and cannot edit their assigned role.

Managers retain member administration and exclusive active-estate role deletion.
Deletion requires no assignees and physically removes the role, links and **all**
referencing invitation history atomically. We accept this history loss rather
than introducing archival/deleted-definition semantics.

Invitation operations lock invitations before the estate; role/member deletion
rechecks the locked reference set after acquiring the estate and restarts the
transaction when a reservation introduced a new row. Reservation creates a new
row only after its estate lock, avoiding FK locks before the estate. All writes
recheck authority under that lock. Pending offers survive Manager-to-CUSTOM
demotion while the inviter remains an estate member; removal cancels them.
Custom INVITE_MEMBERS permits only same-estate custom subsets and own offers.
This refines the demotion policy in ADR 0028; other preset demotions retain the
previous cancellation behavior. Inactive estates prohibit reassignment even for
no-ops; existing read/removal/cancellation policies remain.

The review follow-up keeps deletion orchestration in EstateRoleService, including
authorization, lifecycle/assignee checks and transaction retries. Its repository
provides persistence operations within each service-owned transaction. Keep the
retry loop outside those transactions so a changed invitation reference set
releases locks before retrying. Member/eligible-role/invitation lists resolve
permission data in bulk and reuse request-local catalogue results, preserving
live permission enforcement without per-row database calls.

## Consequences

Permission edits and reassignment take effect with the same bearer token. No
permission snapshots, per-user overrides, arbitrary runtime codes, WorkOS role
writes or extra dependencies are needed. Broader preset asset/report CRUD is
separate work. Generated contracts and capability-driven UI preserve independent
role, report, invitation and management entry.

Ship compatible CUSTOM readers/guards/acceptance before a later release enables
CUSTOM writes. The final working tree has writes enabled; human reviewers must
split the agreed successive releases. After custom offers or memberships exist,
old binaries are unsafe rollback targets. Migration drift must be reconciled
without resetting the existing database. See the plan's rollout gates and
`.docs/api/estate-roles.md` for the concrete operational sequence.
