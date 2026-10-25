# Custom estate roles

Source of truth: `packages/api/openapi.json`. JWT subject supplies identity;
current ownership, membership and persisted permissions supply authority on every
request. Roles belong to one estate. A member has one preset or custom role;
custom roles do not inherit preset powers. Existing presets remain immutable.

## Endpoints

All paths use UUID `estateId` and `roleId`. A real JWT subject is required even
in local open-security mode. GET responses use `Cache-Control: private, no-store`.

| Method/path | Request | Success | Authority |
| --- | --- | --- | --- |
| GET `/estates/{estateId}/role-permissions` | None | 200 EstatePermissionResponse[] | Manager or CREATE_ROLES/EDIT_ROLES; delegated caller sees only own permissions |
| GET `/estates/{estateId}/roles` | None | 200 EstateRoleDefinitionResponse[] | Same; delegated caller sees definitions wholly within own permissions |
| POST `/estates/{estateId}/roles` | CreateEstateRoleRequest | 201 EstateRoleDefinitionResponse | Active estate, Manager or CREATE_ROLES; delegated grants must be a subset of own |
| PUT `/estates/{estateId}/roles/{roleId}` | UpdateEstateRoleDefinitionRequest | 200 EstateRoleDefinitionResponse | Active estate, Manager or EDIT_ROLES; delegated editor must hold both old and new sets and cannot edit own assigned role |
| DELETE `/estates/{estateId}/roles/{roleId}` | None | 204, no body | Active estate, Manager only, no assigned members |

400 invalid UUID/body/name/permissions; 401 missing identity; 403 missing authority
in a known estate; 404 inaccessible estate or missing/foreign role; 409 duplicate
normalized name, stale version, inactive estate or remaining assignees; 503 storage
or required permission catalogue unavailable. JSON errors are EstateError
`{message: string}`; authentication failures may have an empty body.

## DTOs and validation

- EstatePermissionResponse: `code: PermissionCode`, `label: string`,
  `description: string`, `requires: PermissionCode[]`. Labels/descriptions come
  from the persisted Permission catalogue; enforcement recognizes only the codes
  below, in this fixed order.
- CreateEstateRoleRequest: `name: string` (trimmed, nonblank, max 40),
  `description?: string | null` (trimmed, blank becomes null, max 500),
  `permissions: PermissionCode[]` (required, nonempty, unique, no nulls).
- UpdateEstateRoleDefinitionRequest: the same fields, plus required positive
  `expectedVersion: int32`. A PUT replaces the entire name/description/set.
- EstateRoleDefinitionResponse: `id/estateId: UUID`, `name: string`,
  `description: string | null`, `permissions: PermissionCode[]`,
  `createdAt/updatedAt: datetime`, `version: int32`, `canEdit/canDelete: boolean`.
  Version begins at 1; a material edit increments it once. A valid no-op preserves
  version/timestamps, but still requires current authority, activity and version.

| PermissionCode | Required permission | Grants |
| --- | --- | --- |
| VIEW_ESTATE | None | Estate details/list/dashboard and active location hierarchy |
| EDIT_ESTATE | VIEW_ESTATE | Estate details editing, including inactive estates |
| VIEW_FAULT_REPORTS | None | Same-estate reports, private images and historical location context |
| RELOCATE_FAULT_REPORTS | VIEW_FAULT_REPORTS | Report location correction in an active estate |
| INVITE_MEMBERS | None | Bounded custom invitations and own outstanding offers |
| CREATE_LOCATIONS | VIEW_ESTATE | Active-estate blocks, levels/common areas and bulk floors |
| EDIT_LOCATIONS | VIEW_ESTATE | Rename/reorder/move active locations in an active estate |
| CREATE_ROLES | None | Bounded custom-role creation |
| EDIT_ROLES | None | Bounded custom-role editing, excluding own assigned role |
| VIEW_DOCUMENTS | None | List, search and download invoices and service reports, including inactive history |
| EDIT_DOCUMENTS | VIEW_DOCUMENTS | Upload in active estates; delete own files; Managers retain deletion of any estate document |

Prerequisites are explicit: the server rejects a missing prerequisite and never
adds one silently. Unknown codes or inconsistent stored sets fail closed. Reserved
names, compared after trim/lowercase: manager, admin, manager (admin), council,
council member, resident, crew, member, owner. Names are unique per estate by
normalizedName. Internal whitespace is preserved. Lists sort by normalized name,
then UUID; permission arrays use catalogue order. There is no arbitrary permission
administration API.

Role lists load definitions, their permission rows and assigned role IDs in bulk.
Filtering and response mapping reuse those results without per-role database
queries. Both individual and bulk permission lookups reject unsupported codes,
missing catalogue entries and incomplete prerequisite sets.

Assignments and invitations reference the live same-estate definition. Edits
immediately affect assignees and pending offers; membership and invitations are
not copied or cancelled. See [council-invitations.md](council-invitations.md) for
selectors and version-aware recipient acceptance. Custom permissions never grant
member administration, ownership transfer, deactivation, asset writes, sensor
management or broader report CRUD.

Deletion locks referencing invitations before estate/role locks, rechecks current
Manager authority and assignees, and removes **every referencing invitation of
any status**, permission links and the definition in one transaction. Failures
roll everything back. Remaining assignees block deletion even if inactive.
Pending invitations alone do not block deletion. Unrelated rows remain. Old links
and late provider callbacks cannot recreate a deleted role or membership.

EstateRoleService owns deletion authorization, lifecycle/assignee checks and
the bounded eight-attempt transaction retry loop. Each attempt locks invitation
IDs in order before estate/definition locks and rechecks the reference set.
New references cause rollback before the next attempt starts; there is no outer
transaction around the retry loop. EstateRoleRepository supplies the lock/read
queries and deletes the invitations, permission links and definition inside the
service's transaction. It does not decide deletion policy or retry transactions.

Example POST body:

```json
{"name":"Fault reviewer","description":"Read estate reports","permissions":["VIEW_FAULT_REPORTS"]}
```

The 201 response includes the new UUID, version 1 and caller action flags. PUT
with the full body and `"expectedVersion":1` changes it atomically. DELETE needs
no version body, but rechecks all deletion guards under locks.

## Persistence and release preparation

Prisma migration `20261024010000_custom_estate_roles` adds Permission,
EstateRoleDefinition, EstateRolePermission and nullable composite custom-role
references on memberships/invitations. It seeds nine codes, preserves preset
rows and enforces CUSTOM iff a non-null same-estate reference exists. Restrictive
FKs protect catalogue codes, roles and estate boundaries. Runtime queries use
generated jOOQ tables; Spring does not change schema.

Validate migrations/code generation against disposable Postgres. The dev Neon
database inspected during implementation has an applied
`20261022045018_device_deactivation_and_replacement` migration missing from this
checkout; reconcile that migration before applying this branch there. No reset or
live migration was performed.

Release through successive normal dev/main pipeline releases, as required by the
[agreed plan](../../.spec/features/custom-estate-role-creation.md#migration-and-rollout):
first ship the additive schema and compatible CUSTOM readers, guards, DTOs and
version-aware acceptance, with role mutations unavailable and CUSTOM invitation/
assignment selectors rejected. Verify all serving API revisions support the new
rows, then release these role mutations and the generated-client UI. This working
tree contains the final enabled implementation; it must be split into those
reviewed releases before deployment. No rollout has been performed or verified.
Once CUSTOM memberships **or offers** exist, roll forward; an old preset-only API
is not a safe rollback target. Exercise the plan's assignment, email/IN_APP,
revocation, editing, deletion and delegated-access release gates in the deployed
environment. No automatic account conversion or release flag is introduced.
