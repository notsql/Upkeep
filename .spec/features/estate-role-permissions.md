# Estate role permissions

**Status:** agreed
**Owner:** unassigned

## Problem

The built-in roles (Manager, Council, Crew, Resident) are enforced by
hard-coded role-name and ownership checks spread across about 40 server files
and 33 web files. Custom roles use a separate system: permission codes from a
seeded `Permission` catalogue, resolved live on every request (decision 0032).
Because the two do not share one model, the agreed role policy (first recorded
in `custom-estate-role-creation.md`, "Preset-role policy") was never built:

- A Manager who is not the owner cannot open the asset register, add or edit
  assets, see maintenance, costs, failure risk, per-asset readings or devices,
  add floors or edit locations. All of these are owner-only (`findOwned`).
- Council can only read the asset list and History; they cannot add, edit or
  retire assets.
- Crew can view and upload invoices and service reports, which the policy
  does not give them, and cannot change a report's urgency or type, review
  duplicates or dismiss a report, which it does.
- Anyone signed in can search for any estate and report a fault there
  (decision 0053), including people with no estate and staff of other estates.
- The legacy `MEMBER` role still grants Council-like access.

This spec rebuilds the four built-in roles as fixed bundles of the same
permission codes custom roles use, extends the catalogue so the policy can be
expressed, and applies the agreed rules.

## Agreed role policy

Agreed with the user on 2026-11-17. Authority is always per estate: a role in
estate A grants nothing in estate B.

| Role | Authority |
| --- | --- |
| Owner | The account that created the estate (`Estate.ownerUserId`). Holds every Manager permission, plus the only right to **deactivate** the estate and to **transfer ownership** to an existing Manager of the same estate. After a transfer, the former owner stays a Manager and loses both rights. |
| Manager | Every permission code, plus member administration. Everything the owner can do except deactivate and transfer ownership. |
| Council | Estate dashboard (read), full asset access including maintenance, costs and budget, device monitoring (read), invoices and service reports. |
| Crew | Fault reports: view, relocate, change urgency and type, review duplicates, dismiss. Work orders: view, and start or complete the ones assigned to them. Readings: view and record. Inspections: view and record. No invoices or service reports. |
| Resident | No staff permissions. Reports faults in the estates they belong to and reads their own reports. |
| Custom | The codes a Manager (or a delegated author) selected, as today. May now include the new codes. |
| No estate | Can create an estate, which makes them its owner. Cannot report faults. |

"Delete an estate" means the existing soft delete (deactivate). The legacy
`MEMBER` role is converted to Council.

## Permission catalogue

The 11 existing codes stay, unchanged in meaning. Fifteen are added. "Requires"
is the prerequisite rule already enforced by `EstatePermissionCode.requires()`.

| Code | New | Requires | Covers |
| --- | --- | --- | --- |
| `VIEW_ESTATE` | | | Estate dashboard and management pages (read) |
| `EDIT_ESTATE` | | VIEW_ESTATE | Edit estate details |
| `INVITE_MEMBERS` | | | Invite people (custom inviters: same-estate custom roles they hold, per 0032) |
| `CREATE_ROLES` | | | Create custom roles |
| `EDIT_ROLES` | | | Edit custom roles |
| `CREATE_LOCATIONS` | | VIEW_ESTATE | Add blocks, floors and common areas |
| `EDIT_LOCATIONS` | | VIEW_ESTATE | Rename and deactivate locations |
| `VIEW_FAULT_REPORTS` | | | Estate fault report list and detail |
| `RELOCATE_FAULT_REPORTS` | | VIEW_FAULT_REPORTS | Correct a report's location |
| `TRIAGE_FAULT_REPORTS` | yes | VIEW_FAULT_REPORTS | Change urgency and Safety, change type, confirm/reject/link duplicates, dismiss |
| `VIEW_WORK_ORDERS` | yes | | Work order list, detail and history, contractor directory (read), contractor email status. A work order's attached files also need VIEW_DOCUMENTS (agreed 2026-11-18: Crew don't see them) |
| `PROGRESS_ASSIGNED_WORK_ORDERS` | yes | VIEW_WORK_ORDERS | Start and complete a work order assigned to yourself |
| `MANAGE_WORK_ORDERS` | yes | VIEW_WORK_ORDERS | Create, edit, assign, progress any, correct completion, send a report to a contractor, email or retry a contractor, link documents, edit the contractor directory |
| `VIEW_ASSETS` | yes | | Asset register and detail, lifecycle History, maintenance records, failure risk, service intervals, work order completions, asset documents |
| `EDIT_ASSETS` | yes | VIEW_ASSETS | Add, edit, retire, restore and correct assets; record maintenance |
| `VIEW_COSTS` | yes | VIEW_ASSETS | Costliest assets and 12-month budget forecast |
| `VIEW_READINGS` | yes | | Estate and per-asset readings, series, groups, export, anomaly assessments |
| `RECORD_READINGS` | yes | VIEW_READINGS | Manual readings, anomaly assessments (reset), anomaly checks |
| `IMPORT_READINGS` | yes | VIEW_READINGS | Import CSV batches and revert them |
| `VIEW_DEVICES` | yes | | Device list, device monitoring (flatline) status and policies |
| `MANAGE_DEVICES` | yes | VIEW_DEVICES | Register, replace and deactivate devices; issue device keys; set flatline policies and pauses |
| `VIEW_INSPECTIONS` | yes | | Inspection results, inspection assets, the due list, inspectors |
| `RECORD_INSPECTIONS` | yes | VIEW_INSPECTIONS | Record an inspection and its photos |
| `MANAGE_INSPECTIONS` | yes | VIEW_INSPECTIONS | Check schedules (category and asset service intervals, silent-failure categories), generate the due list, send crew to inspect |
| `VIEW_DOCUMENTS` | | | List, search and download invoices and service reports |
| `EDIT_DOCUMENTS` | | VIEW_DOCUMENTS | Upload documents and delete your own uploads |

Built-in role bundles:

| Code | Manager | Council | Crew | Resident |
| --- | --- | --- | --- | --- |
| VIEW_ESTATE | ✓ | ✓ | | |
| EDIT_ESTATE | ✓ | | | |
| INVITE_MEMBERS, CREATE_ROLES, EDIT_ROLES | ✓ | | | |
| CREATE_LOCATIONS, EDIT_LOCATIONS | ✓ | | | |
| VIEW_FAULT_REPORTS, RELOCATE_FAULT_REPORTS, TRIAGE_FAULT_REPORTS | ✓ | | ✓ | |
| VIEW_WORK_ORDERS, PROGRESS_ASSIGNED_WORK_ORDERS | ✓ | | ✓ | |
| MANAGE_WORK_ORDERS | ✓ | | | |
| VIEW_ASSETS, EDIT_ASSETS, VIEW_COSTS | ✓ | ✓ | | |
| VIEW_READINGS, RECORD_READINGS | ✓ | | ✓ | |
| IMPORT_READINGS | ✓ | | | |
| VIEW_DEVICES | ✓ | ✓ | | |
| MANAGE_DEVICES | ✓ | | | |
| VIEW_INSPECTIONS, RECORD_INSPECTIONS | ✓ | | ✓ | |
| MANAGE_INSPECTIONS | ✓ | | | |
| VIEW_DOCUMENTS, EDIT_DOCUMENTS | ✓ | ✓ | | |

Outside the catalogue (not grantable to custom roles):

- **Manager only:** member administration. That means changing a member's
  role, removing a member, deleting a custom role, and setting invitation
  permissions. This keeps decision 0032, confirmed by the user on 2026-11-17.
- **Owner only:** deactivating the estate and transferring ownership.
- **Manager only:** deleting any document. Others can delete only their own
  uploads, as today.

## Behaviour

### One permission model

- Every estate-scoped authorization decision on the server is made by asking
  whether the caller holds a permission code in that estate. The only
  exceptions are the owner-only and Manager-only actions listed above. No
  service checks a role name or `Estate.ownerUserId` directly to grant access.
- A Manager, Council or Crew member holds exactly the codes in their role's
  bundle. The bundles are read from the database on every request, as custom
  grants are.
- A Resident holds no codes.
- A custom-role member holds exactly their role's current, valid grants. The
  0032 rules are unchanged: an invalid grant set yields no codes.
- The estate owner holds every code in that estate, whatever their membership
  row says, unless that row is `RESIDENT`. A same-estate Resident/owner
  conflict still fails closed (0027).
- A user with no membership in an estate gets `404 Estate not found` from
  every estate-scoped endpoint, as today.
- A write to a deactivated estate returns `409 This estate is inactive.` for
  every role, as today. Reads keep their current behaviour.
- `GET /estates/{estateId}/role-permissions` lists all 26 codes, each with its
  `requires` list.
- A Manager can create or edit a custom role with any of the 26 codes,
  subject to the prerequisites.
- A delegated custom-role author can still grant only codes they hold
  themselves (0032).
- Custom roles that existed before the change keep exactly their grants.

### Owner and Manager

- A Manager who is not the owner gets `200` from every asset, maintenance,
  cost, failure-risk, per-asset reading, device, anomaly, floor and location
  endpoint that the owner gets `200` from today.
- A Manager who is not the owner gets `403` when deactivating the estate
  (`POST /estates/{id}/deactivate`) or transferring ownership
  (`POST /estates/{estateId}/ownership-transfer`).
- After a transfer, the former owner's deactivate and transfer requests
  return `403`. Their other Manager access is unchanged.
- The new owner can deactivate and transfer immediately.
- Ownership can only be transferred to an existing Manager of the same
  estate, as today.
- Any signed-in user, including one with no estate, can create an estate
  and becomes its owner and Manager, as today.

### Council

- Council can list, view, add, edit, retire, restore and correct assets.
- Council can list and record maintenance records.
- Council can view the costliest assets and the budget forecast.
- Council can view failure risk and an asset's work order completions.
- Council can view the estate dashboard and management pages, but cannot edit
  estate details (`403`).
- Council can view, upload, download and delete their own invoices and
  service reports.
- Council can view device monitoring and the device list, but cannot register,
  replace or deactivate devices, issue keys, or change flatline policies or
  pauses (`403`). Read access is today's behaviour. The existing platform-admin
  override that lets Council manage device monitoring stays as it is.
- Council get `403` from fault reports, work orders, readings, inspections,
  invitations, roles and member administration.

### Crew

- Crew can list and view fault reports and change a report's location.
- Crew can change a report's urgency and Safety flag.
- Crew can change a report's type.
- Crew can confirm, reject and manually link duplicate reports.
- Crew can dismiss a report.
- Crew get `403` from `POST /estates/{estateId}/reports/{reportId}/work-order`
  (send to a contractor), because it creates a work order.
- Crew can list and view work orders, their history, the contractor
  directory, and contractor email status. They cannot see the files attached
  to a work order, which are invoices and service reports.
- Crew can start and complete a work order assigned to them.
- Crew get `403` when starting or completing a work order assigned to someone
  else or to a contractor.
- Crew get `403` from creating, editing or assigning work orders, from
  correcting a completion, from emailing or retrying a contractor, from
  linking documents, and from editing the contractor directory.
- Crew can view estate and per-asset readings and record manual readings.
- Crew get `403` from importing and reverting readings.
- Crew can view and record inspections and view the due list.
- Crew get `403` from editing check schedules, generating the due list and
  sending crew to inspect.
- Crew get `403` from listing, downloading, uploading and deleting invoices
  and service reports. Documents they uploaded before this change stay in the
  estate for Managers and Council.
- Crew get `403` from assets, costs, devices, estate editing, locations,
  invitations, roles and member administration.

### Fault reporting

- `GET /resident/context` lists every active estate where the caller has a
  membership row of any role: Resident, Manager, Council, Crew or custom.
  The estate they own is included through their Manager row.
- `canSubmit` is `true` exactly when that list is not empty.
- A user with no membership gets `{ "estates": [], "canSubmit": false }`.
- `POST /resident/reports`, `POST /resident/reports/image-slots` and
  `GET /resident/locations` return `404 Estate not found.` for an estate
  where the caller has no membership, and for a deactivated estate.
- `GET /resident/estates` (search any estate) is removed.
- A user who is a Resident in estate A and Crew in estate B can report in
  both A and B. Neither membership grants anything in the other estate.
- `GET /resident/reports` still lists every report the caller submitted,
  including reports filed in estates they do not belong to under the old rule.
- On `/reports/new`, a user with no estate sees a message saying they need to
  be invited to an estate before they can report a fault. They do not see the
  estate picker or the form.
- On `/reports/new`, the estate picker offers only the estates from
  `GET /resident/context`. There is no search box.

### Legacy Member role

- After the migration, no `EstateUser` row has role `MEMBER`. Every former
  `MEMBER` row is `COUNCIL`, and its `estateId`, `userId`, `createdAt` and
  `customRoleId` are unchanged.
- After the contract migration (Phase 8), the database rejects inserting or
  updating an `EstateUser` row with role `MEMBER`, and `EstateUser.role` has
  no default.
- `MEMBER` no longer appears in any response schema's allowed role values, or
  in the role labels returned by who-can-help.

### Access context and the web app

- `GET /access/context` returns, for each estate:
  - every existing flag
  - `canEditAssets`
  - `canViewCosts`
  - `canViewDevices`
  - `canManageDevices`
  - `canManageInspections`
  - `canProgressAssignedWorkOrders`
  - `canTriageFaultReports`
- Each flag is derived from the codes the caller holds, combined with the
  estate being active wherever the flag is a write.
- Existing flags change meaning as follows:

  | Flag | Now equals |
  | --- | --- |
  | `canViewAssets`, `canViewAssetHistory` | VIEW_ASSETS |
  | `canCreateWorkOrders`, `canUpdateWorkOrders` | MANAGE_WORK_ORDERS |
  | `canChangeFaultReportUrgency`, `canReviewFaultReportDuplicates` | TRIAGE_FAULT_REPORTS |
  | `canViewDocuments` | VIEW_DOCUMENTS |
  | `canUploadDocuments` | EDIT_DOCUMENTS |
  | `canViewEstateDetails` | Holds any code |

  `canViewDocuments` and `canUploadDocuments` no longer have a built-in
  Council and Crew shortcut.
- The web app decides what to show and which routes to allow from these
  flags and from `EstateResponse.owned`, never from `role` strings.
  `role` is used only for labels.
- The owner sees Deactivate estate and Transfer ownership. Other Managers do
  not.
- A non-owner Manager sees every asset, maintenance, cost, reading, device and
  location control the owner sees.
- Council see Add asset, Edit, Retire, Restore and Record maintenance on the
  asset pages.
- Council see the cost cards on the estate Overview.
- Crew see the urgency, type, duplicate and dismiss controls on a report.
  They do not see Send to contractor.
- Crew do not see Documents in the navigation.
- The custom-role form groups the new codes under Assets, Work orders,
  Readings, Devices and Inspections. TRIAGE_FAULT_REPORTS goes under Fault
  reports.

## Data

Prisma models in `packages/db/prisma/schema/schema.prisma`:

- **`Permission`** (existing): the migration seeds the 15 new rows (`code`,
  `label`, `description`), in the same way `20261025110000_documents` seeded
  the document codes.
- **`PresetRolePermission`** (new): stores the built-in role bundles.

  ```prisma
  model PresetRolePermission {
    role       String     @db.VarChar(20)
    permission String     @db.VarChar(64)
    catalogue  Permission @relation(fields: [permission], references: [code], onDelete: Restrict, onUpdate: Restrict)

    @@id([role, permission])
  }
  ```

  The migration adds `CHECK (role IN ('MANAGER', 'COUNCIL', 'CREW'))` and
  seeds the bundle table above. `Permission` gains the back-relation
  `presets PresetRolePermission[]`.

  Only a migration changes this table. No endpoint writes it.
- **`EstateUser`** (existing):
  - The Phase 1 migration converts `role = 'MEMBER'` to `'COUNCIL'`.
  - The Phase 8 migration drops `@default("MEMBER")` and replaces the role
    CHECK with `('COUNCIL', 'RESIDENT', 'MANAGER', 'CREW', 'CUSTOM')`.
  - The legacy `canInviteMembers` column is left as it is.
- No changes to `EstateRoleDefinition`, `EstateRolePermission`, `Estate` or
  the invitation tables. Invitations already reject `MEMBER`.
- Regenerate the jOOQ classes (`pnpm db:generate`).

## API

No endpoints are added. One is removed, three change shape or behaviour, and
many keep their shape but change who may call them. The "Auth" column is the
rule after this change.

**Shape or behaviour changes**

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/access/context` | - | `AppAccessResponse`. `EstateAccessResponse` gains `canEditAssets`, `canViewCosts`, `canViewDevices`, `canManageDevices`, `canManageInspections`, `canProgressAssignedWorkOrders` and `canTriageFaultReports`. `role` drops `MEMBER` | Signed in |
| GET | `/resident/context` | - | `ResidentContextResponse { estates: EstateLabel[], canSubmit: boolean }`. Lists active estates with any membership; `canSubmit` is no longer always `true` | Signed in |
| GET | `/resident/estates` | `q` | **Removed** | - |
| GET | `/estates/{estateId}/role-permissions` | - | `EstatePermissionResponse[]` with 26 codes. The `EstatePermissionCode` enum gains 15 values | VIEW_ESTATE, CREATE_ROLES or EDIT_ROLES (unchanged) |
| POST, PUT | `/estates/{estateId}/roles`, `/estates/{estateId}/roles/{roleId}` | `permissions` may include the new codes | unchanged | CREATE_ROLES / EDIT_ROLES (unchanged) |
| GET | `/estates/{estateId}/members` and invitation responses | - | `role` allowed values drop `MEMBER` | unchanged |

**Fault reporting**

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/resident/reports`, `/resident/reports/image-slots` | unchanged | unchanged; `404` for non-members | Any membership in the active estate |
| GET | `/resident/locations` | unchanged | unchanged; `404` for non-members | Any membership in the active estate |

**Who may call existing endpoints** (request and response unchanged)

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/assets`, `/assets/{id}`, `/assets/{id}/lifecycle-events`, `/asset-history`, `/assets/{assetId}/history`, `/assets/{assetId}/events`, `/assets/{assetId}/failure-risk`, `/failure-risk`, `/assets/{assetId}/work-order-completions`, `/asset-categories`, `/assets/{assetId}/service-interval` | unchanged | unchanged | VIEW_ASSETS |
| POST, PATCH | `/estates/{estateId}/assets`, `/assets/{id}`, `/assets/{id}/retirement`, `/assets/{id}/deactivate`, `/assets/{id}/restore`, `/assets/{assetId}/events` | unchanged | unchanged | EDIT_ASSETS |
| GET | `/estates/{estateId}/costs/top-assets`, `/costs/forecast` | unchanged | unchanged | VIEW_COSTS |
| GET | `/estates/{estateId}/readings`, `/readings/assets`, `/readings/metrics`, `/readings/export`, `/assets/{assetId}/readings`, `/readings/grouped`, `/readings/series`, `/assets/{assetId}/assessments` | unchanged | unchanged | VIEW_READINGS |
| POST | `/estates/{estateId}/readings/manual`, `/assets/{assetId}/assessments`, `/assets/{assetId}/readings/anomaly-check` | unchanged | unchanged | RECORD_READINGS |
| GET, POST | `/estates/{estateId}/readings/imports`, `/imports/{batchId}`, `/report`, `/rows`, `/revert` | unchanged | unchanged | IMPORT_READINGS |
| GET | `/estates/{estateId}/assets/{assetId}/devices`, `/flatlined-sensors`, `/flatline-policies` | unchanged | unchanged | VIEW_DEVICES |
| POST, PUT | `/estates/{estateId}/assets/{assetId}/devices`, `/devices/{deviceId}/credential`, `/deactivate`, `/replace`, `/flatline-policies/{metric}`, `/devices/{deviceId}/flatline-pauses/{metric}` | unchanged | unchanged | MANAGE_DEVICES |
| GET | `/estates/{estateId}/reports`, `/reports/{reportId}`, `/images/{imageId}` | unchanged | unchanged | VIEW_FAULT_REPORTS |
| PATCH | `/estates/{estateId}/reports/{reportId}/location` | unchanged | unchanged | RELOCATE_FAULT_REPORTS |
| PATCH, PUT, POST | `/estates/{estateId}/reports/{reportId}/urgency`, `/duplicate`, `/category`, `/dismiss` | unchanged | unchanged | TRIAGE_FAULT_REPORTS |
| GET | `/estates/{estateId}/work-orders`, `/work-orders/{workOrderId}`, `/status-history`, `/completion-revisions`, `/documents`, `/dispatch`, `/work-orders/assignees`, `/work-order-assets`, `/assets/{assetId}/open-work-order`, `/documents/{documentId}/work-order`, `/history`, `/contractors` | unchanged | unchanged | VIEW_WORK_ORDERS |
| PATCH | `/estates/{estateId}/work-orders/{workOrderId}/status`, `/completion` | unchanged | unchanged | MANAGE_WORK_ORDERS, or PROGRESS_ASSIGNED_WORK_ORDERS when the caller is the assignee |
| POST, PUT, DELETE | `/estates/{estateId}/work-orders`, `/assignee`, `PUT /completion`, `/reports/{reportId}/work-order`, `/dispatch`, `/dispatch/retry`, `/documents/{documentId}/work-order`, `/contractors/**` | unchanged | unchanged | MANAGE_WORK_ORDERS |
| GET | `/estates/{estateId}/inspection-assets`, `/inspection-assets/{assetId}`, `/assets/{assetId}/inspections/**`, `/inspection-results/{inspectionId}`, `/inspection-list`, `/inspectors` | unchanged | unchanged | VIEW_INSPECTIONS |
| POST | `/estates/{estateId}/assets/{assetId}/inspections`, `/inspections/photo-slots` | unchanged | unchanged | RECORD_INSPECTIONS |
| PUT, POST | `/estates/{estateId}/asset-categories/{category}/service-interval`, `/silent-failure`, `/assets/{assetId}/service-interval`, `/inspection-list/generate`, `/assets/{assetId}/inspection-requests` | unchanged | unchanged | MANAGE_INSPECTIONS |
| POST, PATCH | `/estates/{estateId}/locations`, `/locations/{blockId}/floors`, `/locations/{id}`, `/locations/{id}/deactivate` | unchanged | unchanged | CREATE_LOCATIONS (create, floors) / EDIT_LOCATIONS (edit, deactivate) |
| GET, POST, DELETE | `/estates/{estateId}/documents/**` | unchanged | unchanged | VIEW_DOCUMENTS / EDIT_DOCUMENTS; deleting another person's upload is Manager only |
| POST | `/estates/{id}/deactivate`, `/estates/{estateId}/ownership-transfer` | unchanged | unchanged | Owner only (unchanged) |

## Edge cases

- **Owner with a non-Manager membership row.** The 2026-10-22 backfill gives
  owners a MANAGER row. Even so, ownership alone grants every code, so an
  owner whose row is missing, or was later changed to Council, Crew or
  custom, keeps full access. An owner whose row is RESIDENT fails closed
  (0027).
- **Transfer while the former owner is mid-request.** A deactivate request
  that locks the estate after the transfer commits sees the new owner and
  returns `403`. Deactivation and transfer both lock the estate row, as today.
- **Crew demoted while they hold an assigned work order.** They lose
  PROGRESS_ASSIGNED_WORK_ORDERS immediately, and their next start or complete
  request returns `403`. The order stays assigned to them until a Manager
  reassigns it. Today's assignee-validity flag already marks members who
  lost their staff role.
- **Crew documents.** Documents Crew uploaded stay. They can no longer list,
  download or delete them.
- **Crew and per-asset readings.** VIEW_READINGS gives Crew the per-asset
  readings endpoints. The UI still shows Crew no asset pages, because they
  lack VIEW_ASSETS. The user accepted this on 2026-11-17.
- **Report already sent or dismissed.** TRIAGE_FAULT_REPORTS does not bypass
  the existing state rules. Dismissing a report that is not awaiting review
  still returns `409`.
- **Reports filed under the old rule.** Reports that non-members filed in
  estates they do not belong to stay in that estate's list. They also stay in
  the submitter's own history, which is keyed on the submitter, not on
  membership.
- **Membership in a deactivated estate.** That estate is left out of
  `/resident/context`, and reporting into it returns `404`, as today.
- **A custom role holding one of the new codes but not its prerequisite.**
  This can't be saved: the role form and the server both enforce `requires`.
  A stored invalid set yields no codes (0032).
- **Deploy order** (rule 16; a push to `main` migrates `prd` and deploys with
  no ordering).
  - **New server before the migration:** `PresetRolePermission` would be
    missing and every built-in role would lose access. The migration must
    therefore reach `dev` and `prd` in an earlier release than the server
    code that reads it. See Implementation phases.
  - **Old server after the migration:** it ignores the new table. It
    rejects the new codes with `validatedGrants`, so a custom role cannot
    gain them until the new server is live. The MEMBER-to-COUNCIL conversion
    is safe for the old server, which treats both roles alike.
- **MEMBER is locked out in a later migration.** About 30 server test files
  still create MEMBER rows to test today's legacy behaviour. Phase 1 therefore
  only converts existing rows. Phase 8 rejects MEMBER and drops the default,
  once Phases 3-5 have removed MEMBER from the code and tests. Nothing writes
  MEMBER in production: the only path that relied on the default
  (`EstateUserRepository.add`, behind `/api/admin/users/**`) is denied by
  `SecurityConfig`. Remove that insert path, or give it an explicit role, in
  Phase 3.

## Out of scope

- **Editing a report's title, description or photos, and deleting reports.**
  No such operation exists. "Full access to fault reports" here means the
  existing report actions.
- **Hard-deleting an estate.** Deactivate is the delete.
- **Editable built-in roles.** Bundles change only through a migration.
- **Showing built-in roles' permissions read-only on the Roles page.**
- **Notifications.** Recipients stay as they are: Manager and Crew
  memberships, plus the owner for anomaly emails. Custom roles still get none.
- **Platform-admin (WorkOS) overrides.** They are unchanged.
- **Removing the legacy `EstateUser.canInviteMembers` column.**
- **Any new restriction on who can create an estate.**
- **Rate limiting or invitation changes.**

## Decisions

| Choice | Alternative considered | Where to change it |
| --- | --- | --- |
| Built-in roles are fixed code bundles stored in a new `PresetRolePermission` table, resolved at runtime like custom grants. The user asked to "ensure we are using the dynamic permissions system". | A hard-coded `EnumSet` per role in `EstatePermissionCode`, which needs no new table but means a code release to change a bundle. Or one `EstateRoleDefinition` per estate per built-in role, which needs a backfill for every estate and conflicts with the per-estate name rules. | `EstatePermissions.grants` and `authority`, `AccessService`, and the `PresetRolePermission` model |
| Ownership grants every code; deactivate and transfer stay explicit owner checks. | An `OWNER` bundle or codes. Rejected because ownership is a relationship and must not be grantable. | `EstatePermissions.authority`, `EstateService` deactivate, `CouncilRepository.transferOwnership` |
| Member administration stays Manager-only, outside the catalogue (keeps 0032). | A grantable `MANAGE_MEMBERS` code. | `EstatePermissions.Authority.requireManager` and callers. Confirmed by the user on 2026-11-17 |
| Crew cannot send a report to a contractor, because it creates a work order. Agreed with the user on 2026-11-17. | Allow it as a narrow exception to "Crew don't create work orders". | `ReportRoutingService.send` |
| Crew keep starting and completing their assigned work orders. Agreed on 2026-11-17 ("view and update", option a). | Read-only, or progress any order. | `WorkOrderAssignment.mayProgress` |
| Fault reporting needs any membership in the estate. Supersedes 0053. | Residents only, or any signed-in user (0053). | `ResidentReportService`, `ResidentReportRepository.activeEstate` |
| MEMBER becomes COUNCIL in Phase 1. Rejecting MEMBER and dropping the default wait for a Phase 8 contract migration, so the migration-only release doesn't break the ~30 test files that still create MEMBER rows. Agreed by the user on 2026-11-17. | Convert and lock in one migration, rewriting those test fixtures in the same release. Or remove MEMBER memberships, or leave them. | `20261117145338_preset_role_permissions`, the Phase 8 migration, and the `allowableValues` on the responses |
| New UI gates are new boolean flags on `EstateAccessResponse`, following the existing pattern. | Return the raw `permissions: EstatePermissionCode[]` per estate and check codes in the web app. | `AppAccessResponse`, `apps/web/src/lib/estate-destinations.ts` |

## Implementation phases

Build these in order, test-first. Phase 1 must be released (merged to `main`
and migrated on `prd`) before any later phase is merged.

- [ ] **0. Branch and baseline.** `feat/estate-role-permissions` from
  `origin/main` with `--no-track`. Before any database command, confirm that
  Infisical `dev` resolves to the user's own Neon branch.
- [x] **1. Migration (expand).** Seed the 15 `Permission` rows, add and seed
  `PresetRolePermission`, convert MEMBER to COUNCIL, and regenerate jOOQ. Write a migration test first:
  bundles match the table above, and no MEMBER rows remain. Ship it on its
  own. The user applies it to the shared Neon `dev` database.
- [x] **2. Server permission core.** `EstatePermissionCode` gains the 15
  codes and their `requires`. `EstatePermissions` resolves built-in bundles,
  owner-holds-all, Resident-holds-none, and drops the Council and Crew
  document shortcut. Add unit tests per role.
- [x] **3. Server guards, by area.** Replace `findOwned`, role-name and
  owner checks with code checks, in this order:
  - assets and maintenance
  - costs and failure risk
  - readings and anomaly
  - devices and flatline
  - locations
  - fault reports (triage)
  - work orders and routing
  - inspections and check schedules
  - documents
  - who-can-help

  Add an integration test per role per area, for both the `200` and `403`
  cases.
- [x] **4. Fault reporting by membership.** Make `/resident/context`
  membership-based, check membership on submit, slots and locations, and
  remove `GET /resident/estates`. Write a decision record superseding 0053.
- [ ] **5. Access context.** Add the new flags, re-derive the existing ones,
  and drop MEMBER from the schemas. Run `pnpm api:generate` and then
  `pnpm fix`.
- [ ] **6. Web.**
  - Move the 33 files that gate on `role` or `owned` onto the flags.
  - Asset, cost and device controls for Managers and Council.
  - Report triage for Crew.
  - Hide Documents for Crew.
  - Report form without search, plus the no-estate message.
  - Role form groups for the new codes.
  - Move any screen you touch onto shadcn and folder routes (rule 10).
- [ ] **7. Docs.**
  - Update `.docs/api/`: access, estate-roles, resident-reports, assets,
    readings, devices, work-orders, documents.
  - Update `.docs/frontend/` to match.
  - Add a decision record amending 0032: built-in roles become bundles.
  - Update the `.spec/README.md` row.
- [ ] **8. Contract migration.** Once no code or test uses MEMBER:
  replace the `EstateUser` role CHECK with
  `('COUNCIL', 'RESIDENT', 'MANAGER', 'CREW', 'CUSTOM')` and drop
  `@default("MEMBER")`. Write a migration test first.

## Resolved questions

Answered by the user on 2026-11-17.

1. **Member administration stays Manager-only.** Changing roles, removing
   members, deleting custom roles and setting invitation permissions stay
   outside the catalogue (decision 0032). There is no `MANAGE_MEMBERS` code.
2. **Crew may call the per-asset readings endpoints.** VIEW_READINGS alone is
   enough, although the UI gives Crew no asset pages.
3. **Council keep read-only device monitoring** (VIEW_DEVICES) and also see
   each asset's device list.
4. **The owner is a Manager** with two extra abilities: transferring
   ownership and deactivating the estate.
5. **The user applies the migration to the shared Neon `dev` database.**
   Hand-off point: the end of Phase 1, before any later phase is merged.
