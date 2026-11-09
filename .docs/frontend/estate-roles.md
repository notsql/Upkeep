# Custom estate roles UI

Routes (folder-based, under `apps/web/src/routes/_auth/estates/$estateId/roles/`):

| Route | File | Tab title |
| --- | --- | --- |
| `/estates/$estateId/roles` | `index.tsx` -> `-components/estate-roles-page/estate-roles-page.tsx` | `pageHead("Estate roles")` |
| `/estates/$estateId/roles/new` | `new/index.tsx` -> `new/-components/new-role-page/new-role-page.tsx` | `pageHead("New role")` |
| `/estates/$estateId/roles/$roleId/edit` | `$roleId/edit/index.tsx` -> `$roleId/edit/-components/edit-role-page/edit-role-page.tsx` | `pageHead("Edit role")` |

Shared `roles/-components/`:

- `role-access-gate.tsx` - `RoleAccessGate` render-prop: PageLayout (the
  new/edit pages pass `className="max-w-3xl"`, the form page width), then
  LoadingState / `ErrorState` "Retry access" / "Estate roles unavailable",
  else the page.
- `role-form.tsx` composes `role-form-details-fields.tsx`,
  `role-form-permissions.tsx` and `role-form-footer.tsx`; `use-role-form.ts`
  holds state, `AREA_OF` and validation.
- `role-form.tsx` - `RoleForm({ catalogue, initial?, pending, error, onSave,
  cancel? })`. `FormCard` "Details" (Role name, Description (optional)) and
  `FormCard` "Permissions" (description "Choose at least one. Some need a
  prerequisite chosen too.") with one `FieldSet` + label-style `FieldLegend` per area (legend = group name: Estate, Fault reports,
  Members and roles, Locations, Documents). The area map is client-side
  (`AREA_OF`) because `EstatePermissionResponse` carries no area. Each permission
  is a bordered Checkbox + label + server description + "Prerequisite: ...".
  The footer (`role-form-footer.tsx`) closes the Permissions card and copies
  `FormActions`' layout (`border-t pt-5`, primary submit then Cancel): submit
  "Create role" / "Save role", "Saving role…" while pending; `cancel` is the
  page's outline Cancel link. Validation messages are a destructive `Alert`.
- `role-row.tsx` - table row: name, description, "Own role · read-only",
  "In use · reassign members to delete"; first three permission Badges + "+N
  more"; outline Edit link (`Pencil`, to the edit route, only when
  `canEditRoles` and `role.canEdit`) and outline Delete button (Managers).
- `delete-role-dialog.tsx` - the delete confirmation, a `ConfirmDialog`
  ("Delete role", `Trash2` destructive "Delete role" / "Deleting role…",
  outline "Keep role"; locked while pending; errors as an alert line).

List page: `ListPageHeader` "People & access" (`icon={ShieldCheck}`, no
description) with the Filters toggle (only once roles exist) and
`CreateButton` "Create" (to `roles/new`) when `canCreateRoles` and the
catalogue loaded. Below it the "People views" `SubNav` (`PeopleViews`, see
[council-invitations.md](council-invitations.md)): Members and Waiting to join
only with `canOpenMembers`, Roles with `canOpenRoles` (a roles-only user sees
just Roles). `/roles/new` and `/roles/$roleId/edit` have no sub-nav. Then the
retractable `FilterBar` "Filter roles" (collapsed by default; search by name
or description; "1 active" and the bar's ghost Clear filters). Then
LoadingState (`table`) -> `ErrorState` "Retry roles" -> EmptyState "No custom
roles yet" ("Use Create to add the first custom role" when the user can
create; no action) -> "No matching roles" EmptyState (outline Clear filters) or Table "Custom roles"
(Role, Permissions, Actions). Inactive estate: Alert "Estate inactive · roles
read-only".

New-role page: `FormPageHeader` "Create role" (description "Name the role and
choose what it can do") with breadcrumbs `Roles ›
Create role` (`Members › Create role` when opened from the invite dialog), then
RoleForm; its outline Cancel link returns to the roles list or the council.
The parent crumb is a link to `/estates/$estateId/roles` (or
`/estates/$estateId/council` for Members). Search param `returnTo`
(validated; only `"council"` is kept). On success it navigates to the roles
list, or with `returnTo=council` to
`/estates/$estateId/council?inviteRole=<new id>` (see council-invitations.md).
Without `canCreateRoles`: "Role creation unavailable". A failed catalogue is
`ErrorState` "Retry permissions".

Edit-role page: `FormPageHeader` "Edit <name>" with breadcrumbs `Roles › Edit
role` (Roles links to `/estates/$estateId/roles`), RoleForm with `initial`. A failed load is `ErrorState` "Retry role".
There is no single-role GET, so it reads the role from `useEstateRoleDefinitions`.
Own role -> "Own role · not editable"; missing -> "Role not found". Save sends
the observed `expectedVersion` and returns to the list; a conflict keeps the
draft and offers outline "Reload role", which adopts the refreshed version.
Edit is a page, not a dialog, for consistency with create: same sectioned form,
the permission list is long, and the URL is linkable.

There are no Tabs (the endpoint returns only custom roles) and no member count
(the DTO has none). UI copy is short labels, not sentences. shadcn components:
Alert, Badge, Button/buttonVariants, Card, Checkbox, Dialog, Field, Input, Label,
Table, Textarea; `FormCard` from `components/page/form-page.tsx`. DTOs come from generated `@proj/api/schema`; API calls
live in `lib/estate-roles.ts`.

The server route guard and mounted page independently require the target estate's
`canViewEstateRoles`. Access loading displays status text; failure displays Retry
and mounts no forms. This screen does not fetch management estate details, so
role-only authors can enter without VIEW_ESTATE. The header uses access-context
estateName. Navigation exposes Roles in estate links and a named global entry for
a scoped-only estate. Home sends an author-only user here. See [shell.md](shell.md).

Selection is exact; empty or missing-prerequisite choices show validation
("<Permission> requires <prerequisite>") without silently adding permissions.
Inputs enforce 40/500 character limits. Errors preserve the draft; pending writes
disable controls and prevent duplicate submits. The server's per-definition
canEdit flag hides Edit for bounded/own-role edits.

Only Managers see Delete. Estate and definition flags disable deletion when
inactive or assigned; explanatory text asks for reassignment/removal. The dialog
names the role and states "Permanent · invitations and invitation history
deleted · pending links stop working". Pending deletion prevents dismissal. Failures retain
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

The Roles list header uses `icon={ShieldCheck}` (sidebar People & access); the new-role
form header uses `ShieldPlus` and the edit form `ShieldCheck`. The "No custom roles" empty state uses `ShieldCheck` and "No matching roles" uses `SearchX`. No header repeats the estate name. Row Edit and Delete are `ghost` (Delete opens the destructive confirm).
