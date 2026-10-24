# Custom estate roles: creation, editing, deletion, assignment and enforcement

**Status:** implemented and locally verified (2026-10-24); changes uncommitted; staged deployment remains a human release step.
**Owner:** unassigned
**Related features:** [Estate roles and invitations](estate-role-invitations.md),
[Neon role authority](neon-role-management.md)

## Problem

Estates currently share the fixed MANAGER, COUNCIL, RESIDENT and CREW roles.
Admins cannot define a role with a name and permission selection suited to their
estate's management style. The existing member page assigns preset roles but
does not create role definitions.

**User story:** As an admin, I want to create custom roles for an estate so each
estate can be managed in its own style.

**Acceptance criteria:**

1. Admins can access a page that allows role creation for an estate.
2. Admins can assign permissions to the new role.
3. Admins can assign a custom role to an existing member of that estate.
4. The member can perform the selected actions, and unselected actions remain
   denied in both the UI and direct API requests.
5. Admins can invite a new estate member directly into a custom role. Acceptance
   grants that role without an intermediate preset-role assignment.
6. Custom-role members with INVITE_MEMBERS can invite into same-estate custom
   roles whose permissions are a subset of their own.
7. Custom-role members can create/edit estate locations or create/edit custom
   role definitions when assigned the corresponding permission. Role creators
   can select only permissions they currently hold; editors must hold every
   current and proposed permission of the target role and cannot edit the role
   they are currently assigned.
8. Editing a custom role updates its current members and pending invitations
   to use the new permissions. Editing a definition does not cancel those offers.
9. Managers can delete a custom role only after no estate members hold it.
   Deletion permanently removes every invitation referencing that role, regardless
   of status, its permission links and the role itself in one transaction. It
   never automatically unassigns members.
10. Manager, Council, Resident and Crew are protected preset roles and cannot
    be deleted by any Manager, including the estate owner.

**Confirmed policy refinements:** names have a 40-character limit; descriptions
are optional with a 500-character limit; reserved names, at least one permission
and active-estate-only creation are required. Existing-member role reassignment
requires an active estate. Manager-to-custom demotion preserves outstanding
invitations and accepted members remain independent. Reactivation is a separate
feature. Custom-role deletion is Manager-only, requires an active estate and is
blocked by assigned members.
Once no members hold it, deletion permanently removes the role, its permission
links and all associated invitations, including pending/SENDING, accepted,
cancelled and expired offers, in one transaction. Invitation history is not
retained, and pending invitations need not be cancelled manually first.
Preset-role deletion is prohibited. Delegated role
creators can select only permissions they hold. Delegated editors must hold both
the target role's current and proposed permissions and cannot edit their own
assigned role, including its name or description.

The user approved the original four permission codes, VIEW_ESTATE, EDIT_ESTATE,
VIEW_FAULT_REPORTS and RELOCATE_FAULT_REPORTS, and the catalogue prerequisite
rules. EDIT_ESTATE, CREATE_LOCATIONS and EDIT_LOCATIONS require VIEW_ESTATE;
RELOCATE_FAULT_REPORTS requires VIEW_FAULT_REPORTS. Together with the five
previously confirmed codes, this confirms the nine-code catalogue below.
Delegated role-authoring bounds and the prohibition on editing one's own assigned
role are confirmed. Active-estate-only custom-role deletion is also confirmed;
no additional asset permissions were requested.

All repositories created or edited in this work, including `CouncilRepository`,
must use typed jOOQ query builders and generated tables/fields, never handwritten
runtime SQL. New selectable permissions include location creation/editing and
custom-role creation/editing. Role edits update pending offers to the new
permissions, as confirmed by the user.
The permission catalogue is persisted in a shared `Permission` table, and role
permission rows reference its stable codes through a foreign key.

These feature rules revise the as-built Manager-only invitation policy and
Manager-to-custom cancellation behaviour described in the earlier invitation
spec/ADR 0028. Existing accepted decisions remain historical records. The
send-time-authority interpretation for retained offers follows the approach in
[ADR 0024](../decisions/0024-invitation-permission-revocation-affects-future-invites.md):
losing invite permission blocks future sends, not an already-authorized offer,
while member removal cancels outstanding offers. Record the agreed revision in
a new decision note during implementation.

## Scope and existing constraints

The user confirmed **usable custom roles**: creation, permission selection,
assignment to estate members and server enforcement are one delivery. A saved
definition alone is insufficient. Creating a definition grants nobody access;
assigning it changes that member's access on subsequent requests.

Direct invitations into custom roles are also confirmed for this delivery,
covering new accounts through email and existing accounts through the current
in-app acceptance flow. Existing members use explicit role changes; invitations
never overwrite memberships. Do not add an unscoped user-grant endpoint or a
temporary preset-role assignment as a workaround.

In this repository, Admin means the canonical estate-local **MANAGER** role.
Current ownership also supplies Manager authority, subject to the existing
same-estate Resident conflict safeguard. WorkOS authenticates the caller; its
role claims do not confer estate authority. Ownership remains a separate
relationship and cannot be created through a custom role.

The broader future requirement in estate-role-invitations includes role and
permission CRUD. Role authoring in this story covers creating, editing and
deleting custom roles, selecting from application-defined permissions; admins cannot invent
executable permissions by entering arbitrary names. Assignment and invitations
reference the same editable definitions. Built-in roles cannot be edited or deleted.
Deleting custom roles is not delegated by CREATE_ROLES or EDIT_ROLES, and no
DELETE_ROLES permission is added to the nine-code catalogue.

## Preset-role policy and implementation boundary

The user reconfirmed the following target policy. All estate authority is scoped
to the estate where the account has the role; membership in A grants no authority
in B. Manager and Admin are aliases for MANAGER. Ownership is a relationship on
Estate, not an additional assignable role.

| Role / relationship | Target authority |
| --- | --- |
| Estate owner | The admin creating the estate becomes its owner. Has Manager authority and the exclusive right to delete that estate. Can transfer ownership to another existing same-estate Manager/Admin. The former owner immediately loses deletion authority, retaining their Manager membership. A non-owner Manager can never delete the estate. |
| Manager / Admin, MANAGER | Manages every member's role within assigned estates, including other Managers, subject to owner/self-change and active-estate safeguards. Creates, reads and updates estates; estate deletion additionally requires current ownership. CRUD authority over estate fault submissions, including residents' reports; the role management dashboard; the estate management dashboard; estate assets; and estate roles/permission assignments. Can invite into preset roles, including Manager, and custom roles. |
| Council, COUNCIL | CRUD authority over estate assets and read access to the estate management dashboard. No invitation, member/role-management or estate-wide fault-report authority from this preset alone. |
| Resident, RESIDENT | Creates fault reports only in the estate(s) where assigned and reads their own past reports. No preset authority to edit/delete reports, read other residents' private history or manage estate resources. |
| Crew, CREW | CRUD authority over all fault submissions in assigned estates, including modifying residents' reports. No estate, asset, invitation or role-management authority from this preset alone. |

Only Managers among the **preset roles** can invite users into an estate.
The user explicitly retained custom-role INVITE_MEMBERS alongside this rule:
authorized custom inviters can offer only same-estate custom roles whose
permissions they also hold. Neither Council nor Crew nor Resident implicitly
gains invitation authority. Invitations establish estate membership after
verified acceptance; no unscoped user-creation or direct membership bypass is added.

CRUD means create, read, update and delete for the relevant estate resources.
The matrix records the intended complete role policy, not a claim that all those
operations already exist. The user confirmed that implementing broader CRUD
remains **separate feature work**. This story still implements the nine explicit
custom permissions, definition creation/editing/deletion, membership assignment and the
agreed invitation/enforcement flows. In particular:

- Full report creation/editing/deletion by staff, including modifications beyond
  the implemented location correction, remains separate from VIEW_FAULT_REPORTS
  and RELOCATE_FAULT_REPORTS in this delivery.
- Broader Manager/Council asset CRUD authority and changes to currently
  owner-scoped asset reads/aggregates require their separate feature work. The
  custom catalogue does not gain asset permissions merely from this matrix.
- Estate deletion remains separate. Custom-role deletion is included with the
  member/invitation safeguards below. Existing estate deactivation is not
  silently treated as permanent deletion. Owner-only
  deletion/transfer boundaries must be preserved when those operations are built.
- Dashboard CRUD describes the underlying managed resources. Do not invent
  generic create/delete-dashboard endpoints from that wording; specify the
  resource operations in the feature implementing them.
- CRUD authority over role permissions includes selecting/changing a role's
  supported Permission links. The Permission catalogue itself remains managed
  through migrations with corresponding enforcement code; arbitrary executable
  permission-definition CRUD remains excluded.

Existing self-service estate creation remains available to any authenticated
account and grants ownership/Manager only in the new estate. The matrix confirms
that Managers can create estates without revoking the previously agreed creation
ability of other accounts. Existing registration/authentication is unchanged.
Preset roles continue to use their current role discriminator and explicit
implemented checks; this policy documentation introduces no extra table,
membership backfill or additional migration beyond the three-table design below.

## Behaviour

### Access and estate scope

- A Manager/Admin of estate A can open `/estates/A/roles` to view, create and
  edit A's custom roles. A custom member with CREATE_ROLES or EDIT_ROLES can
  enter the same page with only their permitted actions and manageable definitions.
  Provide an estate-scoped Roles link using access capabilities.
- Council, Crew, Resident, unassigned users and custom members without either
  role-authoring permission cannot read administration definitions or author
  roles. Authority in A never grants role-authoring rights in B.
- Route entry and form rendering wait for resolved target-estate access. Access
  lookup failure displays an error with Retry and does not display the form.
  Spring checks authority independently on every request.
- Authorized authors may read their scoped definitions while inactive, but
  creation and editing require an active estate. The page explains the gate.

### Form and permission selection

- The form shows the estate name, a required Role name, an optional Description,
  and a labelled permission checklist with human-readable descriptions.
- Names are trimmed, nonblank and at most 40 characters. Descriptions are
  trimmed, at most 500 characters, and stored as null when blank.
- Role names are unique within one estate after trimming and case-insensitive
  comparison. `Caretaker` and ` caretaker ` conflict in A, while B may use the
  same name. Use one server normalization rule and persist its comparison key.
- Built-in names and their UI aliases are reserved case-insensitively: Manager,
  Admin, Manager (Admin), Council, Council member, Resident, Crew, Member and
  Owner. Custom names cannot impersonate a preset or ownership relationship.
- Every permission is unchecked initially. At least one must be selected.
  Unknown codes and duplicate codes are rejected rather than silently ignored.
- Permissions with prerequisites cannot be saved without them. The form explains
  the prerequisite and the API validates the same rule; nothing is silently added.
- Submitting creates the role and its exact permission set in one transaction.
  A failed validation or storage operation leaves no partially created role.
- A successful save shows confirmation and the new role with its selected
  permission labels in the estate's list. Refreshing the page retains it.
- While saving, the form disables duplicate submission. Validation, permission
  and server errors retain the entered values and selection for correction.
- Creating a custom role does not replace built-in roles, change ownership,
  modify memberships or send invitations. A separate, explicit member-role
  change assigns it to an existing estate member.

### Editing roles and delegated authoring

- CREATE_ROLES and EDIT_ROLES are independent permissions. Managers can create
  and edit every custom definition in their estate. A delegated creator can
  save only permissions they currently hold. A delegated editor can edit only
  definitions whose current and proposed permission sets are subsets of their
  own. Validate both sets server-side after acquiring locks; a role name or
  forged request cannot bypass the confirmed bounds.
- Creation/editing capabilities provide the supporting catalogue and definition
  reads; they grant no member roster, membership-role reassignment or ownership
  authority. Only Managers can reassign estate members. A custom author cannot
  edit the definition of their currently assigned role, even to reduce permissions,
  rename it, change its description or submit a no-op. This restriction concerns
  the role they hold, not other roles they created. Recheck the current membership
  under the estate lock; the UI and direct API enforce the same prohibition.
- Editing can change the name, description and selected permissions, using the
  creation validation rules. Keep ID, estate and creator fixed; built-in roles
  and ownership relationships cannot be converted or edited through this API.
- Save the whole definition and permission set transactionally. Increment its
  version and updated timestamp on changes. A stale expected version returns
  409 without overwriting another editor's save; a valid no-op preserves both.
- The next request by every current assignee uses the edited permissions with
  the same JWT. Referencing pending invitations display and activate the latest
  permission set, including when it exceeds the inviter's permissions after
  that original offer was authorized. The role editor must be authorized for
  that change. Do not cancel offers, clone definitions or copy permissions into
  invitations. Changing a definition is distinct from reassigning a member;
  both mutations require an active estate.
- Refresh an explicit acceptance preview if its role version changed before
  the recipient clicked Accept. A stale expected version returns 409 and no
  membership; show the updated role/permissions before retry. Provider-verified
  email reconciliation continues its existing flow and activates the latest
  referenced definition under lock. Listing alone never grants access.

### Deleting custom roles

- Only a current Manager/Admin of the target estate, including its owner, can
  delete a custom role. CREATE_ROLES and EDIT_ROLES do not grant deletion.
- Manager, Council, Resident and Crew are immutable presets for deletion
  purposes. They never appear as deletable definitions; direct requests cannot
  bypass this protection, even when no members hold a preset.
- The role must have zero assigned members. Managers must first explicitly
  reassign each member to another preset/custom role or remove their membership
  under the existing safeguards. "Unassigned" means no longer holding the
  deleted role; this feature does not introduce roleless estate memberships.
- Invitations do not block deletion and need not be manually cancelled first.
  Permanently delete every invitation referencing the role, including pending,
  in-flight SENDING, accepted, cancelled and expired offers. Invitation history
  is intentionally lost. Deleting an accepted invitation does not remove or
  alter the resulting membership; any member still holding the role blocks
  deletion until explicitly reassigned or removed.
- Deletion requires an active estate, matching
  definition creation/editing. Recheck current Manager authority, lifecycle,
  assigned members and referencing invitations transactionally, preserving the
  invitation-before-estate-before-definition lock order. A stale page or
  concurrent assignment/invitation/acceptance must not bypass these checks.
  Do not acquire invitation locks after taking the estate lock; if new invitation
  references appeared before the estate lock was acquired, restart the transaction
  with those invitation locks included before deleting anything.
- Physically delete the referencing invitations, role-permission links and role
  definition in one transaction; no `deletedAt` marker or historical invitation
  snapshot is retained. Keep the global Permission catalogue intact. Failure
  rolls back all deletions. Deleted roles disappear from lists and choices;
  future edits, assignments, sends, retries and acceptance fail safely because
  the role or invitation no longer exists. Old invitation links cannot activate
  membership. Delayed provider callbacks/finalization must not recreate a deleted
  invitation or role, grant membership or fall back to a preset.
- Require an explicit confirmation naming the role and explaining that all its
  invitations and invitation history will be permanently deleted, including
  invalidating pending links. If any member still holds the role, return 409
  without changes and explain that reassignment/removal must happen first.
  All checks apply to direct API calls as well as the UI.

### Location creation and editing

- CREATE_LOCATIONS permits creating blocks, levels and common areas, including
  the existing bulk-floor creation operation. EDIT_LOCATIONS permits renaming,
  reordering and moving active locations within the estate. Neither implies
  the other, estate-detail editing, location deactivation or reactivation.
- Both require VIEW_ESTATE for existing estate/hierarchy navigation. Preserve
  hierarchy/type rules, same-estate parent checks, sibling-name/level-position
  uniqueness, cycle prevention, and the bulk floor limits. All location writes
  require active estate/location/ancestors as applicable and current permission
  under the estate lock. Inactive or foreign nodes grant no bypass.
- Location moves/renames use existing current-path semantics for assets/reports
  and filters; do not rewrite historical report content or introduce snapshots.

### Member assignment and safeguards

- On the existing Estate members page, Managers can choose either a preset or
  a custom role belonging to that estate for another existing member. Display
  the custom name and selected permissions before confirming the change.
- Each member has exactly one role per estate. Assigning a custom role replaces
  the previous role and its permissions; permissions are never combined with
  the previous role. Switching to a preset clears the custom-role reference.
- Unknown/foreign role IDs and nonmember targets cannot create grants. A role
  in A cannot be assigned in B. Other-estate memberships remain unchanged.
- Managers cannot remove or demote themselves. Assigning a custom role to a
  Manager is a demotion and requires another current Manager in that estate.
  The current owner must transfer ownership before changing to a custom role.
- Ownership transfer still requires another existing same-estate MANAGER;
  a custom role with estate-edit permission is not an eligible recipient.
- Demoting a Manager to a custom role does not cancel their outstanding
  invitations, even if the new role lacks INVITE_MEMBERS. Accepted members keep
  independent memberships. Role changes preserve report identity, history and
  images. Remove the existing automatic invitation cancellation specifically
  from Manager-to-custom demotion; existing preset-to-preset policy is otherwise
  unchanged. Losing INVITE_MEMBERS through a later custom-role reassignment
  likewise blocks new invitations without cancelling already-authorized offers.
- A Resident-to-custom change is an explicit role conversion requiring
  confirmation: new resident submissions in that estate cease, while the user's
  own historical reports remain readable. Reassigning RESIDENT removes custom
  grants. No implicit promotion follows from submitted reports or role names.
- No existing-member role reassignment is permitted while the estate is inactive,
  including preset-to-preset, preset-to-custom and custom-to-custom changes.
  Reject PUT requests with 409 under the estate lock before updating membership
  or related invitations. A repeated assignment request also receives 409 while
  inactive, so clients cannot use it to bypass the lifecycle gate.
- Role reassignment becomes available only after estate reactivation. This story
  does not add a reactivation endpoint or screen; that remains a separate feature.
  Existing reads, member removal and invitation cancellation retain their own
  policies; an invitation still cannot overwrite an existing member's role.

### Direct custom-role invitations

- A current Manager can invite into the estate's presets or custom definitions.
  A custom member may invite only with INVITE_MEMBERS in their current role and
  only into same-estate custom roles whose permission set is a subset of their
  own. Equality is allowed. They cannot offer presets, including Manager, or a
  custom role containing any permission they lack. Validate eligibility in the
  API, not only the picker. Invitations require an active estate.
- Show the offered role name and permissions before sending. Custom inviters
  can fetch eligible invitation-role choices, list only their own outstanding
  invitations and cancel only their own. Managers retain estate-wide invitation
  administration. INVITE_MEMBERS does not grant the member roster, custom-role
  creation, role reassignment or the full administration catalogue.
- Persist `role: CUSTOM` and the exact `customRoleId` before dispatch. Sending,
  listing or signing up grants no membership. WorkOS supplies identity, email
  delivery and verification only; the estate role is never a WorkOS role.
- Preserve one invitation slot per estate/normalized email across presets and
  custom definitions. SENDING retries keep invitation UUID, sender, role and
  custom-role ID. Switching between two custom roles is a role change even
  though both have discriminator CUSTOM: return 409 and require cancellation
  before a new attempt. Preset replacements clear the old custom-role reference.
  Definition edits keep that same reference and update the offer's effective
  permissions. A SENDING retry after an edit refreshes expectedRoleVersion and
  rechecks current sender/target eligibility; it does not silently switch IDs or
  reuse an obsolete preview. Already-authorized delivered offers stay valid.
- New-account invitations use the existing email flow. Only the provider's
  existing-account rejection falls back to IN_APP without email; other failures
  preserve retry state. Retain the existing seven-day expiry policy.
- Outstanding invitations and recipient offers display the custom name and
  selected permissions. Verified recipients see only their matching offers;
  they do not gain access to the estate role catalogue before joining.
- Explicit acceptance uses the stored role selection, with no client-provided
  role override. Preserve provider-verified email reconciliation for email
  invitations and explicit acceptance for IN_APP. Listing offers never accepts.
- Under invitation-before-estate locks, acceptance verifies recipient identity,
  email, expiry/status, active estate, the inviter's continued same-estate
  membership/ownership and the same-estate custom definition. Invitation authority
  and target-role eligibility are checked when reserving/sending the offer; a
  later Manager-to-custom demotion or loss of INVITE_MEMBERS does not invalidate
  that already-authorized offer. Do not reapply the inviter's reduced permission
  subset to such an existing offer at acceptance. Atomically insert the CUSTOM
  membership with that exact definition ID and consume the invitation. No transient Council,
  Crew or Manager membership is created. The selected permissions are enforced
  on the recipient's subsequent requests without another sign-in.
- An existing same-estate membership, including the same custom role, causes
  explicit 409; provider reconciliation leaves the membership untouched. Other
  estate memberships and resident report history remain intact.
- Cancellation and inviter removal prevent later activation. Demotion to a custom
  role alone does not. Accepted
  recipients retain independent memberships if their inviter later loses access.
  Replacement attempts use fresh UUIDs and cleared provider metadata, so late
  callbacks/finalization cannot change or activate the replacement.
- Definitions are editable and invitations reference their current permissions
  rather than storing a second permission authority. Missing or
  invalid references deny activation with no partial membership; there is no
  fallback to a preset. Edits update existing pending offers as agreed. Once no
  members hold a custom role, deleting it permanently removes all referencing
  invitations in the same transaction; missing invitations and role definitions
  deny subsequent acceptance, retries and delayed provider activation.

### Permission enforcement

- The API resolves the authenticated subject's current target-estate membership
  and persisted custom permission set for each request. JWT role claims, UI
  state and submitted permission lists cannot grant authority.
- A custom member receives exactly the selected catalogue operations and their
  documented supporting reads. Missing/unknown permissions and broken role
  references deny access. A storage failure returns controlled 503, never a
  fallback to a preset or ownership-derived grant for that custom membership.
- Custom-role assignment/removal takes effect on the next request with the same
  JWT. Mutations lock the estate and recheck authority after acquiring the lock;
  an already completed response cannot be recalled.
- Existing preset-role policies remain explicit. Custom roles do not inherit
  Council, Crew or Manager authority merely because one capability overlaps.
- The same permission policy drives access projection, scoped collections,
  navigation, route entry and API guards. Hiding a control is insufficient.
- A report-only custom role can enter report routes without estate-management
  access. A role with estate-view permission can view estate details without
  obtaining assets, member rosters or owner-scoped portfolio asset summaries.

### Confirmed permission catalogue and prerequisites

The user confirmed these nine codes and their prerequisites. Every code must
have working API enforcement in this delivery. Delegated creators can grant only
permissions they hold; editors must hold the target's current and proposed sets
and cannot edit their own assigned role. These bounds are confirmed.

| Code | Label and intended operation | Prerequisite |
| --- | --- | --- |
| `VIEW_ESTATE` | View estate details and the existing management dashboard | None |
| `EDIT_ESTATE` | Edit estate details; excludes deactivation and ownership transfer | `VIEW_ESTATE` |
| `VIEW_FAULT_REPORTS` | Read the estate's fault reports, details, images and required location context | None |
| `RELOCATE_FAULT_REPORTS` | Correct a report's location while the estate is active | `VIEW_FAULT_REPORTS` |
| `INVITE_MEMBERS` | Invite into eligible same-estate custom roles; view/cancel own outstanding invitations | None |
| `CREATE_LOCATIONS` | Create locations, including bulk floors, in an active estate | `VIEW_ESTATE` |
| `EDIT_LOCATIONS` | Rename, reorder or move active locations within an active estate | `VIEW_ESTATE` |
| `CREATE_ROLES` | Create custom roles with permissions the author already holds | None |
| `EDIT_ROLES` | Edit other eligible custom roles without exceeding the editor's permissions; excludes their own assigned role | None |

| Permission | Existing operations to authorize for custom members |
| --- | --- |
| `VIEW_ESTATE` | Include the estate in GET `/estates`, permit GET `/estates/{estateId}`, and include it in `/dashboard/summary` estate counts. Permit active hierarchy GET reads. Owner-scoped asset/condition/member aggregates retain their existing scope. |
| `EDIT_ESTATE` | PATCH `/estates/{estateId}` only, including inactive-estate editing as for current Managers. This does not grant location creation. |
| `VIEW_FAULT_REPORTS` | GET estate report list/detail/private images and GET locations with `includeInactive=true` for filters/history; preserve existing pagination, privacy and same-estate checks. |
| `RELOCATE_FAULT_REPORTS` | PATCH `/estates/{estateId}/reports/{reportId}/location`; retain active-estate/destination/ancestor checks and expected-location conflict protection. |
| `INVITE_MEMBERS` | GET eligible invitation-role choices; POST estate invitations only for same-estate custom roles with a subset of the caller's permissions; GET own outstanding invitations; DELETE own invitation. No member/role administration or preset-role invitation authority. |
| `CREATE_LOCATIONS` | POST `/estates/{estateId}/locations` and POST `/estates/{estateId}/locations/{blockId}/floors`; retain existing hierarchy and bulk-floor validation. |
| `EDIT_LOCATIONS` | PATCH `/estates/{estateId}/locations/{id}`; preserve same-estate hierarchy and lifecycle checks. No location deactivation authority. |
| `CREATE_ROLES` | Supporting GET permission catalogue/scoped definitions and POST `/estates/{estateId}/roles`; proposed permissions must be a subset of the caller's current set. |
| `EDIT_ROLES` | Supporting GET permission catalogue/scoped definitions and PUT `/estates/{estateId}/roles/{roleId}`; both current/proposed permission sets must be within the editor's set; editing their own assigned role is forbidden. Changes affect current assignees and pending offers. |

The catalogue is persisted in the global `Permission` table: stable codes,
labels and descriptions are seeded through Prisma-managed migrations. Spring
reads it through typed jOOQ and returns the supported entries through the API.
The implemented operation mapping and prerequisite rules remain explicit in
Spring code; a database row alone cannot create executable authority. API
permission codes remain an enum, and frontend types come from generated OpenAPI.
There is no estate-admin permission-definition CRUD in this story. The UI never
constructs permission codes or authorizes an operation
from a label. Estate deactivation and ownership transfer remain owner-only;
Membership-role reassignment and member administration remain Manager-only;
custom-definition creation/editing are delegable through the new codes.
INVITE_MEMBERS delegates only the bounded invitation operations above. Asset permissions need explicit review because
many implemented asset operations remain owner-only despite broader planned
role capabilities in older specs.

## Data

Only Prisma changes schema, in `packages/db/prisma/schema/schema.prisma`.
Only `apps/server` accesses the database at runtime. Every repository created or
edited by this feature, including `CouncilRepository`, uses typed jOOQ for all
of its queries: generated tables/fields, typed joins/conditions/projections,
typed result access and typed mutations/locks. Convert any handwritten runtime
SQL in those touched repositories; do not add SQL strings, string-based table
or field references, raw-query execution or a JDBC fallback. Typed aliases and
jOOQ DSL functions are allowed. SQL in Prisma-managed migration files is a
separate schema workflow, not a repository-query implementation.

| Model | Proposed fields and constraints |
| --- | --- |
| `Permission` (new) | Shared catalogue across all estates: `code: varchar(64)` primary key, `label: varchar(120)` required, `description: varchar(500)` required. Seed one row for each of the nine supported codes above. No estate ID: definitions are shared, while assignment is estate-scoped through roles. |
| `EstateRoleDefinition` (new) | `id: UUID` primary key; `estateId: UUID` required FK to Estate; `name: varchar(40)`; `normalizedName: varchar(40)`; `description: varchar(500)?`; `createdByUserId: varchar(255)` from the authenticated subject; `createdAt/updatedAt: timestamptz`; `version: int` initially 1, incremented on edits. Unique `(estateId, normalizedName)`. Physically deleted with its referencing invitations and permission links; no deletion marker. |
| `EstateRolePermission` (new) | `roleId: UUID` FK to EstateRoleDefinition; `permission: varchar(64)` required FK to `Permission.code`. Composite primary key `(roleId, permission)` prevents duplicates. Restrictive delete/update foreign keys protect referenced definitions and codes. Scope is inherited from the parent role. |
| `Estate` | Add the inverse role-definition relation. Preserve ownership and lifecycle fields. |
| `EstateUser` | Retain `(estateId, userId)` primary key. Add nullable `customRoleId: UUID`; allow the `CUSTOM` role discriminator. Require `CUSTOM` exactly when the reference is non-null, and require null for every preset/legacy role. Composite FK `(customRoleId, estateId)` references `(id, estateId)` on EstateRoleDefinition, with a matching unique target key and restrictive deletion. Keep legacy invitation delegation false for custom assignments. |
| `EstateInvitation` | Add nullable `customRoleId: UUID` and allow CUSTOM alongside the existing invitation presets. Add the same role/reference consistency check and restrictive composite FK `(customRoleId, estateId)` to EstateRoleDefinition. Keep the unique `(estateId, email)` slot and lifecycle/provider fields. Existing invitations keep their preset role and a null custom reference. Delete all referencing invitations explicitly in the role-deletion transaction, regardless of status. |

There are three new tables: Permission, EstateRoleDefinition and EstateRolePermission.
The role definition/link tables start empty; Permission starts with nine seeded
catalogue rows. No WorkOS role or global application-role assignment is added.
Existing memberships retain their current role
and existing invitations retain their stored offer; both get null custom-role
references. This is a schema expansion, not account
reclassification. Definition editing and guarded physical deletion are included.
Restrictive foreign keys block deletion while memberships reference the role;
the service deletes all referencing invitations and role-permission links before
the definition in one transaction. No invitation history or deletion marker is
retained for a deleted role; unrelated invitations and global Permission rows remain.

The Permission catalogue is managed by migrations, not startup insertion or a
new seed-tool dependency. Adding a permission requires its catalogue migration,
Java/API enum and prerequisite/operation enforcement together. Keep the existing
API catalogue order; do not derive authority from labels or database sort order.
Prerequisites remain code-defined in this delivery; no additional prerequisite
table is introduced. A referenced Permission row cannot be deleted or have its
code renamed while role links exist.

Use an additive migration compatible with the currently deployed API. Regenerate
Prisma and jOOQ after migration; never hand-edit generated classes. The unique
constraint decides concurrent same-name requests. Lock the estate before the
write and recheck current authoring permission and active status under that lock,
coordinating with existing membership/ownership/lifecycle writes.
Member role changes retain the existing invitation-before-estate-before-member
lock order to coordinate with acceptance/removal and existing preset transitions.
Manager-to-custom demotion no longer cancels invitations. Permission-checked
business writes take the estate lock before membership checks and must not then
acquire invitation locks in the reverse order.
Definition updates lock estate then definition and atomically replace permissions,
version and timestamp. Invitation reservation, acceptance and member reassignment
read/validate the referenced definition under the same estate lock; permission
changes cannot race past a stale role preview unnoticed.
Deletion locks referencing invitations before the estate and definition, then
rechecks that no membership references the role. If another referencing invitation
appeared before acquiring the estate lock, restart with the complete invitation
lock set before any deletion. Under those locks, delete all referencing invitations,
permission links and the definition atomically. Assignment, reservation and
acceptance recheck definition/invitation existence under the coordinated locks.
Acceptance or assignment that establishes membership first blocks deletion;
deletion that wins prevents stale requests and callbacks from granting membership.

## API

All paths below are **proposed**, not an as-built contract. Use Java record DTOs,
document status codes, and add explicit method/path matchers in SecurityConfig;
its default rule denies unknown routes.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/role-permissions` | None | 200 `EstatePermissionResponse[]` | Manager/owner sees catalogue; custom CREATE_ROLES/EDIT_ROLES sees their grantable permissions |
| GET | `/estates/{estateId}/roles` | None | 200 `EstateRoleDefinitionResponse[]`, custom definitions only, ordered by normalized name then ID | Manager/owner sees all; custom CREATE_ROLES/EDIT_ROLES sees definitions within own permission bounds |
| POST | `/estates/{estateId}/roles` | `CreateEstateRoleRequest` | 201 `EstateRoleDefinitionResponse` | Manager/owner or bounded CREATE_ROLES; active estate |
| PUT | `/estates/{estateId}/roles/{roleId}` (new) | `UpdateEstateRoleDefinitionRequest` | 200 `EstateRoleDefinitionResponse` | Manager/owner or bounded EDIT_ROLES excluding the caller's own assigned role; active estate; expected version |
| DELETE | `/estates/{estateId}/roles/{roleId}` (new) | None | 204, no body | Current same-estate Manager/owner only; active estate; zero assigned members; atomically deletes all referencing invitations, permission links and custom definition |
| PUT | `/estates/{estateId}/members/{userId}/role` (extend) | `UpdateEstateRoleRequest` | 200 extended `EstateMemberResponse` | Current target-estate Manager/owner; active estate; existing self/owner safeguards |
| GET | `/estates/{estateId}/members` (extend) | None | 200 extended `EstateMemberResponse[]` | Current target-estate Manager/owner |
| GET | `/access/context` (extend) | None | 200 extended `AppAccessResponse` | Authenticated subject; current per-estate permissions |
| GET | `/estates/{estateId}/invitation-roles` (new) | None | 200 `EstateInvitationRoleOptionResponse[]` | Manager/owner sees preset/custom choices; custom INVITE_MEMBERS sees only eligible same-estate custom choices |
| POST | `/estates/{estateId}/council-invitations` (extend) | Extended `CouncilInvitationRequest` | 201 extended `CouncilInvitationResponse` | Manager/owner or custom INVITE_MEMBERS with eligible target; active estate |
| GET | `/estates/{estateId}/council-invitations` (extend) | None | 200 extended `CouncilInvitationResponse[]` | Manager/owner sees all; custom INVITE_MEMBERS sees only offers they sent |
| GET | `/council-invitations` (extend) | None | 200 extended `PendingCouncilInvitationResponse[]` | Verified matching recipient |
| POST | `/council-invitations/{invitationId}/accept` (extend) | `AcceptEstateInvitationRequest` for custom offers; none for presets | 200 existing `AcceptedInvitationsResponse` | Explicit verified matching recipient; current referenced role; expected custom-role version |
| POST | `/council-invitations/accept` (extend) | None | 200 existing `AcceptedInvitationsResponse` | Provider-verified email reconciliation; excludes IN_APP |
| POST | `/estates/{estateId}/locations` (extend authority) | Existing `CreateLocationRequest` | 201 existing `LocationResponse` | Existing owner/Manager or custom CREATE_LOCATIONS; active estate |
| POST | `/estates/{estateId}/locations/{blockId}/floors` (extend authority) | Existing `AddFloorsRequest` | 200 existing `AddFloorsResponse` | Existing owner or custom CREATE_LOCATIONS; active estate/block |
| PATCH | `/estates/{estateId}/locations/{id}` (extend authority) | Existing `UpdateLocationRequest` | 200 existing `LocationResponse` | Existing owner or custom EDIT_LOCATIONS; active estate/location |

Existing invitation cancellation retains its DELETE path, 204 response,
and idempotency semantics for both preset and custom offers. Extend authorization
to custom INVITE_MEMBERS callers cancelling their own offers only; inaccessible
or other-sender IDs are hidden with 404. Managers retain estate-wide cancellation.

DTO fields:

- `EstatePermissionCode`: enum containing the implemented catalogue codes seeded
  in Permission; arbitrary database rows never expand the API's supported codes.
- `EstatePermissionResponse`: `code: EstatePermissionCode`, `label: string`,
  `description: string`, `requires: EstatePermissionCode[]`. Code/label/description
  come from Permission; requires comes from the implemented prerequisite rules.
- `CreateEstateRoleRequest`: `name: string`, `description?: string | null`,
  `permissions: EstatePermissionCode[]` (required, nonempty, unique).
- `UpdateEstateRoleDefinitionRequest`: the same editable fields plus required
  `expectedVersion: int` (positive). ID, estate and creator are not editable.
- `EstateRoleDefinitionResponse`: `id: UUID`, `estateId: UUID`, `name: string`,
  `description: string | null`, `permissions: EstatePermissionCode[]`,
  `createdAt/updatedAt: datetime`, `version: int`, `canEdit: boolean` for the
  current caller/estate status, always false for a custom caller's own assigned
  role; add `canDelete: boolean`, true only for a current
  Manager in an active estate when no members
  hold the definition. Invitations do not make canDelete false. Deleted
  definitions no longer exist in administration lists.
  Return permission codes in catalogue order.
- `EstateInvitationRoleOptionResponse`: `role: assignable-role enum`,
  `label: string`, `customRoleId: UUID | null`, `customRoleVersion: int | null`,
  `permissions: EstatePermissionResponse[] | null` (null for presets). Custom
  callers receive only eligible custom choices, without the full role catalogue
  or member roster. Sending still rechecks current eligibility independently.
- `UpdateEstateRoleRequest`: retain required `role`, accepting MANAGER, COUNCIL,
  RESIDENT, CREW or CUSTOM through a shared assignable-role enum; add
  `customRoleId?: UUID | null` and `expectedRoleVersion?: int | null`. CUSTOM
  requires the ID and positive current version; a preset requires both omitted/null.
  Preserve existing `{ "role": "COUNCIL" }` requests. Legacy
  MEMBER remains readable, not newly assignable. Invitation selectors use the
  same preset/custom validation; Owner and Admin are not additional role values.
- `CouncilInvitationRequest`: retain normalized `email: string` with existing
  validation; `role?: MANAGER | COUNCIL | RESIDENT | CREW | CUSTOM` and
  `customRoleId?: UUID | null`, `expectedRoleVersion?: int | null`.
  Omitted role still defaults to COUNCIL and
  explicit null remains invalid. CUSTOM requires an ID; a preset requires it
  omitted/null. CUSTOM also requires a positive current expectedRoleVersion;
  presets require it omitted/null. An ID alone must not silently default to Council. Preserve
  existing email-only and email/preset-role requests.
- `CouncilInvitationResponse` and `PendingCouncilInvitationResponse`: retain
  existing fields, allow CUSTOM in `role`, and add `customRoleId: UUID | null`,
  `customRoleVersion: int | null`,
  `customRoleName: string | null` and
  `customPermissions: EstatePermissionResponse[] | null` (null for presets).
  Custom fields come from the referenced definition, with permission details in
  catalogue order and limited to offered permissions. Recipients receive labels
  and descriptions without a catalogue request or estate access before acceptance.
- `AcceptedInvitationsResponse` remains `{ estateIds: UUID[] }`. Acceptance
  resolves the definition ID from the stored invitation. Explicit custom
  acceptance takes `AcceptEstateInvitationRequest: { expectedRoleVersion: int }`,
  required/positive; it never accepts a replacement role ID or permission list.
  Preset acceptance remains bodyless. Provider-verified reconciliation remains
  bodyless and uses the latest referenced definition, as required for edited offers.
- `EstateMemberResponse`: retain existing fields, allow `role: CUSTOM`, and add
  `customRoleId: UUID | null` and `customRoleName: string | null` (null for
  presets). Managers obtain permission descriptions from the role list.
- Existing `canInviteMembers` response fields in `EstateResponse` and member
  DTOs must reflect current permission and lifecycle policy for the represented
  user. Keep `canManageInvitationPermissions` Manager-only. These are derived
  capabilities; the legacy stored delegation boolean remains nonauthoritative.
- `AppAccessResponse.EstateAccessResponse`: retain existing fields, allow
  `role: CUSTOM`, and add `customRoleId: UUID | null`,
  `customRoleName: string | null`, `canCreateLocations: boolean`,
  `canCreateFloors: boolean`,
  `canEditLocations: boolean`, `canViewEstateRoles: boolean`,
  `canCreateRoles: boolean`, `canEditRoles: boolean`, `canDeleteRoles: boolean`,
  `canReassignRoles: boolean` and `canViewEstateInvitations: boolean`.
  `canViewManagement` maps to VIEW_ESTATE, `canManageEstate` to EDIT_ESTATE,
  `canViewFaultReports` to VIEW_FAULT_REPORTS, and `canRelocateFaultReports`
  to RELOCATE_FAULT_REPORTS plus active-estate status for custom members.
  Custom members have `canViewAssets`, `canManageInvitationPermissions` and
  `canReassignRoles` false. Their location creation/editing and role creation/editing
  capabilities require the matching permission and active estate;
  `canViewEstateRoles` requires CREATE_ROLES or EDIT_ROLES independently of active
  status, with bounded definition reads. `canInviteMembers` requires
  INVITE_MEMBERS and an active estate; `canViewEstateInvitations` requires that
  permission independently of lifecycle and authorizes only own-offer reads.
  For Managers, `canReassignRoles` requires an active estate while existing
  administration-read/removal capability is independent of that write gate.
  Managers retain estate-wide `canViewEstateInvitations`.
  `canDeleteRoles` requires a Manager and an active estate; custom
  members always receive false, including CREATE_ROLES/EDIT_ROLES holders.
  Per-definition `canDelete` additionally checks assigned members; invitations
  do not block deletion because they are removed by the same transaction.
  Other preset capabilities retain their existing policy: owner/Manager location creation,
  owner-only bulk floors/location editing, and Manager role authoring.
  `canCreateFloors` is active-estate owner authority or custom CREATE_LOCATIONS,
  matching the bulk endpoint separately from single-location creation. Other preset powers
  are not broadened. Workspace entry also accepts role-authoring read authority.
  Invitation-only and role-authoring-only custom roles enter their scoped screens
  without estate-management views.
  Resident submission flags still require actual RESIDENT membership.
- Errors reuse `EstateError`: `{ message: string }`.

Statuses: 400 for malformed UUID/body, invalid/reserved name, description limit,
empty/unknown/duplicate permissions or missing prerequisites; 401 for missing
identity; 403 for insufficient authority in an otherwise accessible estate;
404 for a missing or inaccessible estate; 409 for duplicate normalized name or
creation in an inactive estate; 503 for unavailable storage. Apply the project's
existing inaccessible-estate convention consistently and test it for every
built-in role. Security-filter 401/403 may precede the controller error DTO.
List/catalogue responses use `Cache-Control: private, no-store`.
Role assignment additionally returns 400 for an invalid preset/custom selector,
404 for a missing member or missing/foreign custom definition (never reveal
another estate's definition), and 409 for protected owner/self changes.
Inactive-estate role PUT requests return 409 with no role or invitation changes,
including no-op requests; this applies to all preset/custom reassignments.
Invitation creation also returns 400 for invalid email/role selectors, 404 for a
missing/foreign custom role, 409 for changed retry selection/sender or inactive
estate, 502 for provider failure and 503 for unavailable provider configuration
or storage. Acceptance preserves existing 403 for unverified identity, 404 for
missing/inaccessible offers, and 409 for expired/cancelled/consumed/conflicting
offers or failed activation checks. Provider reconciliation skips ineligible
offers without granting membership. Verify exact existing status conventions in
HTTP tests; no raw provider/storage errors are exposed.
Custom inviters offering a preset or a role with permissions outside their own
receive 403 even if they tamper with picker values. Own-offer filtering and
cancellation checks apply server-side; no WorkOS profile directory or member
list is exposed to delegated inviters.
Role editing returns 409 for a stale version, duplicate name or inactive estate;
delegated authoring outside permission bounds or editing one's own assigned role
returns 403 without changes, including metadata-only updates and no-ops. Custom invitation
reservation, reassignment and explicit acceptance return 409 when the selected
role version changed; refresh the current preview before retrying. Location
operations retain existing 400 hierarchy validation, 404 missing/foreign resource
and 409 conflict/inactive errors, with current permission checks at the boundary.
Role deletion returns 204 on success; 403 for a non-Manager in an otherwise
accessible estate; 404 for a missing, deleted or foreign custom definition;
400 for a malformed identifier, including a preset-role code passed as an ID;
and 409 while members hold the role, or while the
estate is inactive. No rejected request changes
memberships, role definitions or invitations. Presets have no deletable custom
definition ID and no deletion endpoint may modify preset roles.

Example POST body:

```json
{
  "name": "Maintenance coordinator",
  "description": "Review estate faults and correct their locations.",
  "permissions": ["VIEW_FAULT_REPORTS", "RELOCATE_FAULT_REPORTS"]
}
```

The 201 response contains the saved definition's UUID, estate ID, normalized
display values, selected codes and creation time. It grants no membership.

To assign it, a Manager sends
`{ "role": "CUSTOM", "customRoleId": "<created-role-uuid>", "expectedRoleVersion": 1 }` to the member-role
PUT. The response identifies the saved custom role; subsequent member requests
use its permissions without a new sign-in.

To invite directly, send
`{ "email": "new.member@example.com", "role": "CUSTOM", "customRoleId": "<created-role-uuid>", "expectedRoleVersion": 1 }`
to the existing estate invitation POST. The 201 response identifies the stored
offer. Membership begins only after verified acceptance, with that custom role.

## Backend enforcement changes

- Use typed jOOQ in every created/edited repository, including all queries in
  `CouncilRepository`, new role repositories and any touched location/access
  repositories. Use generated table/field references and typed record access;
  no pure SQL, raw SQL execution, stringly typed fields or handwritten table names.
  Preserve locks, conflict handling, filters and transaction boundaries while
  converting existing repository queries. Review this requirement across each
  touched repository, not only newly added methods.
- Add explicit estate permission resolution beside `AccessService`, using
  generated jOOQ tables for current membership/definition/role-link/catalogue reads.
  Join `EstateRolePermission.permission` to `Permission.code` for persisted grants
  and metadata; use supported-code/prerequisite checks in the service layer.
  Read labels/descriptions from Permission without a hardcoded metadata fallback.
  Reuse predicates for scoped collection queries and write guards so projection
  and enforcement agree. Keep built-in Manager/ownership predicates separate
  from permission to edit estate details; avoid a general policy-engine dependency.
- Extend `AccessService` and `EstateRepository` estate reads and detail-edit
  guards, plus `DashboardRepository` estate counts. Include only custom estates
  with VIEW_ESTATE in management collections and keep owner asset aggregates
  unchanged. Do not classify every CUSTOM row as management-accessible.
- Split `EstateReportService` read and relocation authorization: currently both
  use a MANAGER/CREW test, which cannot distinguish a custom viewer from an
  editor. Update supporting responder/location guards to allow the exact reads
  required by VIEW_FAULT_REPORTS. Image endpoints require the same current
  permission as detail reads and retain report/image/estate binding checks.
- Extend member-role updates and roster DTOs in the estate feature. Validate the
  same-estate custom definition under the existing transaction, clear obsolete
  custom references when assigning presets, and retain all Manager demotion,
  ownership and removal safeguards. Check active status before any reassignment,
  and remove cancellation for Manager-to-custom demotion while retaining
  cancellation on membership removal.
- Extend invitation reservation, listing, retry matching, replacement and both
  acceptance paths in `CouncilService`/`CouncilRepository` to carry the custom
  reference. Compare the full preset/custom selector, not only the role string.
  Validate the same-estate definition before provider dispatch and recheck under
  the acceptance transaction; insert membership and consume the offer atomically.
  Preserve lifecycle lock order and provider verification/delivery semantics.
- Split `CouncilService`'s existing combined Manager-only access guard into
  Manager administration and bounded invitation checks. Do not open the member
  roster or role mutations merely because `canInviteMembers` is true. Reservation
  and new dispatch/retry requests check current INVITE_MEMBERS and target subset;
  acceptance checks valid original reservation plus continued inviter membership,
  not current invite permission. In-flight dispatch finalization may complete an
  authorized attempt after custom demotion; new dispatch retries still need
  current send authority. Member removal/cancellation wins over late finalization.
- Implement transactional custom-definition editing with expected-version
  checks and replacement of the permission rows. Resolve the current definition
  in member authorization and invitation reads/acceptance, so existing assignees
  and pending offers follow edits without duplicated permission snapshots.
  Check author bounds before applying writes using the pre-edit effective set;
  an editor cannot bootstrap permissions by submitting a new definition first.
  Reject editing the caller's currently assigned custom role after rechecking
  membership under the estate lock, including metadata-only updates and no-ops.
- Implement Manager-only custom-definition deletion with zero assigned members.
  Require an active estate and recheck its status under the estate lock; inactive
  estates return 409 without deleting the role, permission links or invitations.
  Preserve invitation-before-estate-before-definition lock order and revalidate
  references before atomically deleting all referencing invitations, permission
  links and the definition. Roll back all deletions on failure. Reject stale
  assignment/send/retry/acceptance requests and prevent late provider callbacks
  from recreating deleted records or granting membership. Keep unrelated
  invitations, memberships and global Permission rows intact. Never expose preset
  deletion or infer delete authority from delegated creation/editing permissions.
- Extend typed location guards for CREATE_LOCATIONS/EDIT_LOCATIONS, including
  bulk floors and hierarchy moves, and recheck after the estate lock. Retain
  existing validation, descendant/cycle checks and location deactivation guards.
- Audit call sites of `canManageEstate`, management/responder predicates and
  role comparisons. Use explicit location creation/editing and role-authoring
  capability flags; EDIT_ESTATE alone must not enable either. Existing sensor
  policies, asset operations and administration keep their own guards.
  Protected estate operations outside the agreed permission mapping stay denied
  to custom roles. Independent authenticated features, such as account access,
  estate creation and submitter-only report history, retain their own policies.

## Frontend

- Add `apps/web/src/routes/_auth/estates/$estateId/roles/index.tsx` and colocate
  its page, form and permission checklist in `roles/-components/`.
- Keep the creation form and saved-role list on that one page. Include estate
  breadcrumbs, an empty state, loading states and labelled error messages.
  Use existing shadcn Card, Button, Input, Textarea, Label, Checkbox, Badge and
  Alert from `packages/ui`; no new dependency is expected.
  Add definition editing on this same screen, preserving input on errors and
  explaining that a permission change affects current members and pending offers.
  Add Manager-only custom-role deletion using existing shadcn Button and Dialog.
  Confirm the role name and warn that all associated invitations and their
  history will be permanently deleted and pending links invalidated. Disable
  deletion while members hold it and explain the required reassignment/removal;
  invitations do not disable deletion or require a separate cancellation step.
  Disable deletion while the estate is inactive and explain that an active
  estate is required; direct API requests enforce the same gate.
  Presets have no delete controls. On a stale 409, retain the list, refresh the
  definition state and display the blocker without changing members or invitations.
- Add generated-client hooks in `apps/web/src/lib/estate-roles.ts`:
  `useEstateRolePermissions`, `useEstateRoleDefinitions`,
  `useCreateEstateRole`, `useUpdateEstateRoleDefinition` and `useDeleteEstateRole`.
  Query keys are
  `[userId, "estate-role-permissions", estateId]` and
  `[userId, "estate-roles", estateId]`. Gate requests on the resolved session
  and target-estate authority and throw returned API errors in query functions.
- Gate role-page entry with `canViewEstateRoles` and the create/edit controls
  with their specific capabilities and each definition's canEdit flag. Keep
  `canManageInvitationPermissions` for Manager member administration; neither
  that flag nor `canManageEstate` stands in for delegated role authoring.
  Gate deletion with `canDeleteRoles` and each definition's `canDelete`; delegated
  authors never receive delete controls.
  Set `canEdit` false for a custom member's own assigned role and explain why
  editing is unavailable; another authorized editor must change that definition.
  Role-authoring-only users get estate labels from access context without
  fetching estate details or the member roster. Spring remains authoritative.
- Extend the existing member-role picker with estate-local custom definitions
  using shadcn Select and Dialog. Show permissions and confirm replacement,
  including Resident conversion consequences; retain the saved value on error.
  Extend invitation pickers with the same estate-local custom definitions and
  preview their permissions. Custom members see their role name through access
  metadata; list/authoring access requires its separate permission.
- Use the new invitation-roles query for invitation options and the full role
  list for Manager reassignment or bounded authoring. Add `useEstateInvitationRoles`
  in `lib/council-invitations.ts`, keyed
  `[userId, "estate-invitation-roles", estateId]` and gated by invitation access.
  Mount sender-scoped outstanding/cancellation controls for custom inviters.
  Keep member roster and member reassignment controls Manager-only.
- Disable every membership-role picker/confirmation while inactive using `canReassignRoles`
  and show that reactivation is required. A stale open form receiving 409 retains
  its saved role and refreshes estate/access state; hiding controls is not enough.
- Extend existing invitation hooks in `lib/council-invitations.ts` with generated
  preset/custom request fields. Keep selection and email on dispatch failure so
  retries use the same stored role. Cancellation/replacement requires a new send
  attempt; silently changing role during a SENDING retry is disallowed.
- Update outstanding offers, `/invitations`, compact estate/Home invitations
  and both acceptance components to show custom names/permissions. Retain
  existing-account IN_APP messaging and email reconciliation. After acceptance,
  await access/estate/dashboard/report-context refresh before navigating; use
  report entry for report-only roles and management entry for estate viewers.
  An invitation-only custom role lands on its scoped invitation controls without
  calling GET estate details or members. Label the estate using access context.
- Creating a definition invalidates the user's role and invitation-choice lists.
  Deletion invalidates the role list, all assignment/invitation choices and
  outstanding/recipient invitation queries because referencing offers are removed;
  subsequent stale requests are independently rejected by the API.
  Editing also invalidates current-user access, estates, dashboard, member roster,
  invitations, supporting location/report queries and affected private images
  to refresh the affected assignees and offers. Explicit custom invitation
  acceptance submits the preview version; 409 refreshes the role/permissions and
  requires another confirmation. Other users refresh on route entry/focus and
  are independently checked by the server on every operation; no push system is added.
  Assignment/removal reuses member-mutation invalidations for roster, pending
  invitations, access, estate directory, dashboard, resident context and affected
  report queries; await refresh before navigating under changed access.
  Identity changes clear prior-user caches using the existing session helper.
- Use capabilities throughout route guards and desktop/mobile navigation.
  Replace role-name checks that hide management entry for a custom estate viewer.
  Report-only custom roles follow the existing Crew-style report entry without
  receiving the management shell. Use `canCreateLocations` for location forms
  and `canEditLocations` for rename/reorder/move controls; gate bulk floor forms
  with `canCreateFloors`. EDIT_ESTATE shows only the estate-detail editor when
  no location-write permission is assigned. Keep deactivation controls owner-only.
- Refresh access on route entry/focus. If authority is revoked during editing,
  deny the next request and refresh access before showing further controls.
  On 403/404 caused by changed access, discard protected cached content and
  revoke private image object URLs using existing report/session cleanup.

## Edge cases

- Concurrent equal normalized names: exactly one request creates a role; the
  other receives 409. The database constraint applies even across API instances.
- Concurrent Manager demotion/removal, transfer or estate deactivation: the
  transaction uses current authority/status rather than the earlier page load.
- A network timeout can occur after commit. Do not automatically retry POST;
  refetch the saved list so the admin can check whether creation succeeded.
  A manual retry cannot duplicate the normalized name.
- Losing access to the estate prevents further role reads/writes even with the
  same JWT. Foreign route IDs and provider admin claims cannot restore access.
- Empty lists render an explanation and form for eligible admins. Catalogue
  loading/failure prevents submission; an empty catalogue is not permission
  to save an empty role.
- Permissions saved in one estate are never returned under another estate's
  list. Failed permission insertion rolls back the parent definition.
  Permission definitions themselves are shared; estate scoping comes from role
  ownership and links, so sharing a catalogue code grants no cross-estate access.
- The database rejects an EstateRolePermission referencing a nonexistent code
  or deleting/renaming an in-use Permission code. Unknown API codes still fail
  validation. Catalogue storage failure or missing required supported rows
  returns controlled 503 for authoring/catalogue operations, never fabricated
  metadata or additional authority. Unsupported manually inserted codes cannot
  authorize an operation.
- Inactive estates preserve saved definitions for authorized reads. Existing
  membership and report-history behaviour remains governed by its own policies.
- A custom viewer calling relocation directly receives denial without a write;
  an estate-edit-only role cannot create locations or change members. Report images and
  historical hierarchy reads require current report-view permission independently
  of previously cached page access.
- Reassigning a member to another custom role or a preset replaces permissions
  atomically. A same-role assignment is a no-op only when both discriminator and
  definition ID match. Owner and Manager self-action guards still apply to changes.
- Role-definition names are display data. Renaming a request payload or giving a
  custom role an admin-like description never authorizes an administrative action.
- Definition edits change the permissions displayed by every referencing pending
  offer and used by current members; they do not cancel or replace the offer.
  A stale explicit acceptance preview receives 409 without consuming it. A retry
  after refresh or provider-verified reconciliation uses the latest definition.
- Concurrent role editors cannot overwrite each other; the loser refreshes after
  expected-version 409. Subset validation uses the editor's pre-write authority.
  Editing one's own assigned custom role is always rejected with 403 and no
  changes, including permission reductions, metadata-only updates and no-ops.
- Custom-role deletion is rejected while even one member holds the role.
  Reassignment/removal is an explicit prerequisite; invitation cancellation is not.
  Successful deletion permanently removes all referencing invitations of every
  status, permission links and the role in one transaction; failure leaves all
  records unchanged. Concurrent assignment or acceptance that establishes a
  membership first blocks deletion. Reservations are included in the deletion
  transaction or fail on the missing role; retries, old links and late callbacks
  cannot recreate deleted records or grant membership. Accepted memberships in
  other roles and unrelated invitations remain unchanged. Preset deletion and
  delegated-author deletion are always denied.
- Location creation/editing by custom members must preserve parent-estate binding,
  type/ancestor validity, cycle prevention and uniqueness. A permission to create
  a location does not grant editing/deactivation, and editing does not grant
  creation/bulk floors. Revocation during a write is rechecked under the estate lock.
- A foreign/missing custom invitation role fails before provider dispatch;
  missing/invalid references at acceptance grant no membership. Switching from
  custom role A to B during SENDING returns 409 even though both are CUSTOM.
- Explicit acceptance and provider reconciliation racing for one custom offer
  activate it at most once. Concurrent cancellation, inviter demotion, estate
  deactivation and membership creation serialize through existing locks and
  cannot overwrite a membership or reactivate a cancelled offer.
- A Manager demoted to a custom role without INVITE_MEMBERS cannot send/retry
  new invitations, but previously delivered offers remain acceptable while they
  remain a member. The offered role can exceed their new permissions because
  it was authorized when reserved. Removing that member still cancels the offer.
- Reassignment racing estate deactivation rechecks active status under lock.
  If deactivation wins, role PUT returns 409 with no membership or invitation
  side effects. No preset/custom reassignment can be used to reactivate an estate.
- Delegated invitation choices are revalidated at send time. Changing the
  inviter's role after loading options cannot authorize a now-disallowed new
  send; current permission and subset rules apply. No eligible custom choices
  yields an empty list and an explanatory state, never a preset fallback.
- After cancellation and replacement, a late provider response/callback for the
  old invitation cannot set the new attempt's role, status or membership. Preset
  replacements clear custom references; custom replacements persist the new ID.

## Tests and acceptance verification

Read `.spec/testing.md`; write and run each failing behaviour test before its
implementation. Test observable outcomes rather than framework internals.

| Area | Required evidence |
| --- | --- |
| Role page | Manager/owner and bounded custom authors enter through authorized links/deep links; create-only and edit-only controls reflect their independent grants. Role-authoring-only users need no estate-detail/member-roster access. Denied roles and other-estate users cannot author. |
| Permission selection | Checklist labels/descriptions render from the API; selections persist exactly; missing prerequisites, empty and unknown selections fail validation. |
| Persisted catalogue | Migrations seed the nine supported codes exactly once. Typed jOOQ reads return persisted labels/descriptions with code-defined prerequisites. Database foreign keys reject unknown role-permission codes and deletion/renaming of referenced codes; shared definitions do not expand estate scope. Missing/unavailable catalogue data fails safely without fallback authority. |
| Persistence | Create, receive 201, reload list and see the same estate-scoped definition and selected permissions; another estate cannot see it. |
| Validation and races | 40-character names accepted and 41 rejected; optional descriptions accept 500 and reject 501; reserved/blank names, case-insensitive duplicates, nonempty selections, concurrent creation, rollback and active-estate-only creation have HTTP/database coverage. |
| Authorization | Same-token revocation, forged WorkOS roles, foreign estate IDs and authority changes during writes are rejected; ownership and preset role safeguards remain intact. |
| Recovery | Loading/error states, retained form inputs, disabled pending submission, post-commit timeout reconciliation and identity-switch isolation are covered. |
| Assignment | Manager assigns a saved role to a same-estate member; replacement clears prior permissions; preset restoration clears the reference; nonmembers/foreign role IDs and inconsistent selectors are rejected. |
| Custom onboarding | Manager invites directly into a same-estate custom role; new-account email and existing-account IN_APP acceptance each create exactly the stored custom membership. Before acceptance no estate API access exists; afterward selected actions work and unselected actions fail. |
| Delegated invitations | Custom INVITE_MEMBERS users can send into same-estate custom roles with equal/subset permissions and see/cancel their own offers. Missing INVITE_MEMBERS, foreign IDs, presets, supersets, other-sender offers and forged picker values are denied. Invitation-only route entry works without estate-detail, member-roster or role-authoring access. |
| Invitation integrity | Pending/outstanding offers show custom names/permissions only to authorized callers; forged role IDs and acceptance overrides cannot change grants; full-selector retries, fresh replacement UUIDs, expiry, replay, cancellation, inviter demotion and concurrent acceptance preserve lifecycle rules. Provider calls are mocked; tests send no real emails. |
| Enforcement | Exercise each permission through its actual HTTP operations and deep links. Verify selected actions succeed, unselected actions fail, and read-only report roles cannot relocate or bypass private-image checks. |
| Location writes | Independent CREATE_LOCATIONS and EDIT_LOCATIONS grants permit their exact endpoints, including bulk floors for creation, while missing permissions deny. Cover hierarchy moves, cycles, duplicate positions/names, foreign parents, deactivated ancestors/estate and same-token revocation. No custom location-deactivation grant is added. |
| Role editing | CREATE_ROLES/EDIT_ROLES are independent; creator/editor subset bounds, pre-write authority, fixed built-ins, version conflicts and inactive-state denial are covered. Own-assigned-role edits return 403 without changes for permission additions/reductions, metadata-only updates and no-ops; canEdit is false and the UI explains the restriction. An eligible role created by the caller remains editable when it is not their assigned role. Edits replace permissions for current assignees on the next request with the same JWT. |
| Role deletion | Manager deletes a same-estate custom role only in an active estate when no members hold it. Pending/SENDING, accepted, cancelled and expired invitations are all permanently deleted with permission links and the role in one transaction; invitations do not block deletion or require prior cancellation. Remaining members, inactive estate and non-Manager/delegated authors are rejected without side effects. Manager/Council/Resident/Crew deletion is impossible through UI and direct API requests. Cover the history-loss warning, canDelete eligibility, inactive-estate controls and direct API 409, stale-409 recovery, list/picker/invitation removal, rollback after partial deletion failure, unchanged unrelated records and accepted memberships in other roles, old-link rejection and races with assignment/reservation/acceptance/provider callbacks/estate deactivation. |
| Edited offers | Edit a referenced role and verify existing pending/IN_APP/email offers show/use new permissions without cancellation or copied authority. Stale explicit acceptance returns 409; refreshed confirmation and provider-verified reconciliation activate the current role. SENDING retries keep the role reference but refresh the expected version. |
| Existing safeguards | Custom roles cannot reassign/remove members, use asset/sensor administration, deactivate locations/estates or transfer ownership. Location writes and definition authoring require their separate permissions. Owner conversion and Manager self-demotion fail; another Manager's demotion to custom preserves pending offers/accepted memberships, while removal cancels pending offers. |
| Inactive assignment | All preset/custom role PUTs, including no-ops, return 409 while inactive without side effects; stale UI and races cannot bypass the check. Active-state fixtures can reassign again; no reactivation API is added by this story. |
| Revocation and history | Reassignment/removal with the same JWT removes estate/report/image access on subsequent requests; explicit Resident conversions preserve historical own-report access and other-estate grants. |
| Migration and rollout | Existing memberships/invitations retain preset authority with null references; database rejects cross-estate bindings and inconsistent CUSTOM rows in either table; mixed-release checks cover invitation readers/callbacks as well as members before custom writes are enabled. |

Web tests live in `apps/web/tests/`, mirroring routes and hooks, and use
`renderWithProviders`, explicit Vitest imports and accessible queries. Server
tests cover HTTP DTO/status contracts and migrated Testcontainers Postgres for
constraints, transactions and estate isolation. Test code and behaviour, not
generated schemas or shadcn internals.
Review every created/edited repository for generated jOOQ table/field/projection
usage and typed result access; no handwritten runtime SQL may remain in those
repositories. Compile regenerated schema types and retain existing integration
coverage for locks, filtering and transaction outcomes when queries are converted.

## Migration and rollout

1. Add Permission, EstateRoleDefinition and EstateRolePermission, nullable custom
   references on memberships and invitations,
   composite FKs and revised role/reference checks through an expand migration.
   Seed the nine Permission rows in that Prisma-managed migration before any
   role links can reference them; add the role-link-to-code FK with restrictive
   deletion/update. Regenerate Prisma/jOOQ for all three new tables.
   Invitation presets continue to exclude legacy MEMBER. Explicitly
   require a non-null reference for CUSTOM so SQL NULL semantics cannot admit
   an invalid grant. Preserve preset rows, existing pending offers, email-slot
   uniqueness and provider/lifecycle metadata; initialize new references to null.
2. Release API support for CUSTOM membership and editable-definition/invitation
   reads, versioned DTOs, provider reconciliation and permission enforcement, then the compatible
   generated-client web UI, before enabling custom assignment/invitation writes.
   Use successive normal releases through the existing dev/main pipelines;
   the compatibility release leaves the new mutation routes unavailable and
   rejects CUSTOM selectors on the existing member-role PUT and invitation POST.
   Include the new catalogue codes, authoring/location capability fields and
   version-aware acceptance before later releases enable role edits/custom writes.
   Check API rollout completion before the later release enables custom writes.
   Web and API deploy independently, so neither deployment order nor a schema
   expansion alone is sufficient to start writing CUSTOM memberships or offers.
3. Enable creation/editing/deletion, assignment and direct custom invitations only after every
   serving API revision supports the new data, including invitation-list and
   acceptance/reconciliation handlers. Old code has fixed role enums/checks and
   does not clear custom IDs on preset updates. Verify both existing-member
   assignment and email/IN_APP onboarding before considering rollout complete.
4. After CUSTOM membership or invitation rows exist, an old binary is not a safe
   rollback target, even if an offer has not yet been accepted. Roll
   forward with a fix, or use an explicitly reviewed membership-conversion plan
   and pending-offer handling plan before reverting readers. Do not silently
   map custom roles to Council or Manager. No automatic existing-account
   migration is part of this work.

The minimum release gate is a Manager creating a report-view-only role, assigning
it to an existing member, that member reading same-estate reports/images, failing
relocation and unrelated estate/admin requests, and losing access after reassignment
with the same token. Repeat with EDIT_ESTATE to prove detail editing succeeds
while location creation and member administration remain denied.
Repeat onboarding with new-account email and existing-account IN_APP offers:
no membership before acceptance, exactly the offered custom role after verified
acceptance, continued acceptance after Manager-to-custom demotion, and no
activation after cancellation or inviter removal. Exercise delegated invitation
subset/own-offer limits and inactive-estate reassignment rejection as release gates.
Verify independent custom location creation/editing and role creation/editing,
including permission-subset bounds. Edit a role already assigned and offered to
a recipient; confirm immediate assignee enforcement, updated pending permissions,
stale-preview rejection and successful current-version acceptance without cancellation.
Verify deletion is blocked until all assignees have been reassigned/removed,
then succeeds with pending invitations still present and permanently deletes
every referencing invitation, permission link and the role atomically. Verify
rollback on failure, history-loss confirmation, unchanged unrelated records and
memberships, and rejection of old links/late callbacks. Check preset protection,
delegated-author denial and stale-grant races.

## Implementation phases

- [x] Confirm that creation, assignment and runtime enforcement are in scope.
- [x] Include direct custom-role invitations for new and existing accounts.
- [x] Agree the 40-character name/500-character description policy, reserved
  names, nonempty permissions and active-estate-only creation.
- [x] Preserve outstanding offers on Manager-to-custom demotion; block role
  reassignment while inactive; allow bounded INVITE_MEMBERS delegation. Keep
  reactivation separate.
- [x] Include CREATE_LOCATIONS, EDIT_LOCATIONS, CREATE_ROLES and EDIT_ROLES;
  role edits update pending offers to use new permissions. Require typed jOOQ
  throughout every created/edited repository, including CouncilRepository.
- [x] Persist the shared permission catalogue in Permission and link
  EstateRolePermission to Permission.code with database foreign-key integrity.
- [x] Approve VIEW_ESTATE, EDIT_ESTATE, VIEW_FAULT_REPORTS and
  RELOCATE_FAULT_REPORTS, completing the nine-code catalogue. Confirm that
  estate editing and location creation/editing require VIEW_ESTATE, and report
  relocation requires VIEW_FAULT_REPORTS.
- [x] Record the reconfirmed owner/Manager/Council/Resident/Crew target matrix;
  retain custom INVITE_MEMBERS alongside Manager invitations and keep broader
  asset/report/estate CRUD implementation as separate feature work.
- [x] Confirm Manager-only custom-role deletion, blocked until no members hold
  the role; atomically delete every referencing invitation regardless of status,
  permission links and the role itself, accepting the loss of invitation history.
  No manual invitation cancellation is required. Never allow deletion of Manager,
  Council, Resident or Crew presets.
- [x] Confirm delegated authoring bounds: creators grant only permissions they
  hold; editors must hold both current and proposed sets; custom authors cannot
  edit their own assigned role.
- [x] Confirm custom-role deletion requires an active estate; inactive-estate
  requests return 409 without changes and deletion controls are disabled.
- [x] Agree the complete design before coding; user requested implementation against the tests (2026-10-24).
- [x] Write and observe failing server tests for role creation, permission
  validation, assignment, actual allow/deny API operations, same-token revocation,
  custom invitation email/IN_APP acceptance, retry/replacement integrity, estate
  isolation, delegated invite subsets, retained offers after custom demotion,
  location writes, definition editing/versioning/updated offers, inactive
  reassignment, protected owners/Managers and concurrency boundaries.
  Include guarded physical custom-role deletion, removal of invitations of all
  statuses, rollback, preset protection, old links and late callbacks, and races
  with assignment/invitation/acceptance before implementation.
- [x] Add the Prisma expand migration, seed Permission, regenerate Prisma/jOOQ,
  and implement typed catalogue reads, role definitions, membership/invitation bindings, transactional
  assignment and custom invitation reservation/acceptance/delegation. Implement
  permission resolution and update access projection, estate/report/location guards and
  scoped collections against the failing tests.
  Add versioned role updates and location creation/editing checks.
  Add guarded Manager-only physical deletion with atomic removal of referencing
  invitations and permission links; reject deleted-role grants and retain no
  invitation history for the deleted role.
  Convert all queries in every touched repository to typed jOOQ, with no runtime
  SQL strings.
  Keep controllers thin and install no packages or Maven tools.
- [x] Run server tests, export with `pnpm api:generate`, and keep the generated
  OpenAPI/types in the working tree with the implementation.
- [x] Write and observe failing web tests, then add hooks, route, form,
  saved-role list, member assignment controls and capability-based entry using
  existing shadcn controls. Update invitation pickers, pending summaries and
  version-aware acceptance flows. Add bounded definition editing and independently
  gate location creation/editing and role creation/editing. Add Manager-only
  deletion confirmation with a permanent invitation-history-loss warning,
  member blockers, invitation-list refresh and recovery from stale 409s.
- [x] Run appropriate Nx checks plus `pnpm check-types`, `pnpm test` and
  `pnpm fix`; verify actual test execution. Report unrelated baseline failures
  separately rather than claiming an entirely green suite.
- [x] Add `.docs/api/estate-roles.md` and `.docs/frontend/estate-roles.md`, update
  access, invitations/members, estates, dashboard, locations, estate reports and
  shell docs plus `.docs/README.md`. Record the agreed role-binding, catalogue
  and permission-enforcement choices in a new decision note.
- [ ] Prepare and verify the compatible read-before-write release sequence.
  Mark built only after the end-to-end journey and regression checks; leave
  changes uncommitted for human review. Humans perform release/commit steps.

## Out of scope

- Implementing the broader preset-role CRUD matrix: staff report editing beyond
  location correction, staff report creation/deletion, broader Manager/Council
  asset authorization and estate deletion remain separate
  feature work as confirmed by the user. The matrix above remains the target.
- Deleting preset roles, delegating custom-role deletion, cloning or importing
  roles; role inheritance, multiple
  roles per member, per-user overrides and cross-estate role templates.
- Estate-admin CRUD for permission definitions, arbitrary executable permission
  codes or modification of built-in roles. The supported Permission catalogue is
  seeded/updated through migrations alongside corresponding enforcement code.
- Estate reactivation: reassignment requires active status, but adding the
  reactivation flow remains a separate feature.
- Delegating membership reassignment/removal or ownership powers, changing asset
  authorization, WorkOS role management and existing-account migration.
- Dependencies, deployment and commits.

## Open questions

None remaining. The user authorized implementation against the tests on 2026-10-24.

## Implementation verification (2026-10-24)

Review follow-up approved in chat: batch member permissions, invitation-role
options and outstanding/recipient invitation metadata, reusing one catalogue
per request; move role-deletion policy, transaction boundaries and retries to
EstateRoleService. Preserve API shapes, existing permissions, ordering,
invitation-before-estate-before-definition locks and atomic rollback. Existing
HTTP/concurrency tests plus mixed-role and cross-estate list coverage protect
this internal refactor. The 134 custom-role tests passed before and after the
refactor, including the three added list regressions. Deletion race and rollback
coverage remains unchanged.

The final implementation, generated Prisma/jOOQ/OpenAPI artifacts and UI are in
the working tree, uncommitted. A complete uncached Nx regression run executed
1,000 Java tests and 501 web tests, all passing with no skips. This includes a
red/green regression for access refresh after a stale member reassignment. TypeScript checks
passed. `pnpm fix` and the uncached `web:build` production build also passed.
`git diff --check` and documentation-link validation passed.

The expand migration was validated on disposable Postgres, which was also used
for code generation. No live database was reset or migrated. Dev Neon has an
applied `20261022045018_device_deactivation_and_replacement` migration missing
from this checkout; reconcile it before migration deployment.

The final implementation enables custom writes. The compatibility reader release
and later write-enabling release must be separated and verified through the
normal pipelines by humans; no release has been performed. The exact sequence
and rollback limit are in `.docs/api/estate-roles.md`. Deployed end-to-end release
gates remain outstanding; automated tests exercise the corresponding local
assignment, enforcement, invitation, editing, deletion and concurrency behavior.
