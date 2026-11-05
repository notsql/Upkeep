# Custom estate roles UI

`/estates/$estateId/roles` lives at
`apps/web/src/routes/_auth/estates/$estateId/roles/index.tsx` (tab title
`pageHead("Estate roles")`). Route-local `-components/`:

- `estate-roles-page.tsx` - access gate, PageHeader with a primary "Create role"
  Button (lucide `Plus`, shown when `canCreateRoles` and the catalogue loaded),
  then LoadingState (`table`) -> Alert + "Retry roles" -> EmptyState ("No custom
  roles yet", same Create role action) -> FilterBar ("Search roles", matches name
  or description; "No matching roles" EmptyState with Clear filters) + Table
  "Custom roles" (Role, Permissions, Actions).
- `role-row.tsx` - one table row: name, description, own-role and reassignment
  notes; Permissions shows the first three permission Badges plus "+N more";
  Edit / Delete buttons (size sm).
- `create-role-dialog.tsx` - `CreateRoleDialog({ estateId, open, onOpenChange,
  onCreated? })`, the single create-role flow. Loads the catalogue, renders
  `RoleForm`, calls `useCreateEstateRole`, closes and calls `onCreated(role)` on
  success. Reused by the invitation role picker (council-invitations.md).
- `role-dialogs.tsx` - `EditRoleDialog` (title "Edit <name>", RoleForm with
  `initial`, Reload role on conflict) and `DeleteRoleDialog` (confirmation).
- `role-form.tsx` - the name/description/permissions form used by both dialogs.

There are no Tabs: the roles endpoint returns only custom roles (presets have no
editable definitions), and no member count is shown because
`EstateRoleDefinitionResponse` carries none. shadcn components: Alert, Badge,
Button, Checkbox, Dialog, Field, Input, Label, Table, Textarea. DTOs come from
generated `@proj/api/schema`; API calls live in `lib/estate-roles.ts`.

The server route guard and mounted page independently require the target estate's
`canViewEstateRoles`. Access loading displays status text; failure displays Retry
and mounts no forms. This screen does not fetch management estate details, so
role-only authors can enter without VIEW_ESTATE. The header uses access-context
estateName. Navigation exposes Roles in estate links and a named global entry for
a scoped-only estate. Home sends an author-only user here. See [shell.md](shell.md).

Creation and editing display the grantable catalogue inside a Permissions dropdown,
initially closed. Its shadcn Button exposes expanded state and toggles the table
below it. Selections persist when closing/reopening, including saved selections
while editing; the toggle is disabled during saves. The table has Select
(checkbox), Permission name and Description columns. Descriptions wrap and
include prerequisite hints. Each checkbox remains labelled by the permission
name and associated with its description. Selection remains exact; submitting empty/missing-prerequisite choices
shows validation without silently adding permissions. Inputs enforce 40/500
character limits. Errors preserve the draft; pending writes disable controls.
The sorted saved list is the Custom roles table described above.

Editing opens the Edit dialog with a separate draft with the observed version. Save replaces fields
and sends expectedVersion. A conflict refreshes current queries, retains the
draft and offers Reload role; reload deliberately adopts the current version.
Permission-change guidance explains effects on current members and pending
offers. The server's per-definition canEdit flag disables bounded/own-role edits.

Only Managers see Delete. Estate and definition flags disable deletion when
inactive or assigned; explanatory text asks for reassignment/removal. The dialog
names the role and warns that all invitation history is permanently lost and
pending links stop working. Pending deletion prevents dismissal. Failures retain
the dialog and refreshed list; success closes it. The server rechecks each guard.
Inactive estates retain readable definitions/catalogue with writes disabled.

## Queries and mutations

All queries require a mounted authenticated session and resolved target role
capability, with retry false. Keys include the current user's ID.

| Hook | Generated-client endpoint | Key / effect |
| --- | --- | --- |
| useEstateRolePermissions | GET `/estates/{estateId}/role-permissions` | `[userId, "estate-role-permissions", estateId]` |
| useEstateRoleDefinitions | GET `/estates/{estateId}/roles` | `[userId, "estate-roles", estateId]` |
| useCreateEstateRole | POST `/estates/{estateId}/roles` | Sends exact name/description/permissions; no automatic retry |
| useUpdateEstateRoleDefinition | PUT `/estates/{estateId}/roles/{roleId}` | Sends full body plus expectedVersion |
| useDeleteEstateRole | DELETE `/estates/{estateId}/roles/{roleId}` | No body |

Mutation success and error invalidate current-user queries: role definitions,
catalogue, member roster, invitation choices, outstanding/recipient offers,
access/resident context, estate lists/details and scoped collections. This also
reconciles ambiguous timeout outcomes without resubmitting a write. Identity
changes clear the previous user's cached queries.

Invitation/member pickers, confirmation wording and version-aware acceptance are
in [council-invitations.md](council-invitations.md). Independent location controls
are in [locations.md](locations.md). The API's permission/deletion/rollout rules
are in [../api/estate-roles.md](../api/estate-roles.md).

The permission catalogue also offers View invoices and service reports
(`VIEW_DOCUMENTS`) and Edit invoices and service reports (`EDIT_DOCUMENTS`).
Edit requires explicitly selecting View. These permissions cover both document
types independently of general management or fault-report access. Existing
bounded delegation and explicit prerequisite validation apply. See
[documents.md](documents.md) for the document screen and deletion authority.
