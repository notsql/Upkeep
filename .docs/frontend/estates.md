# Estates (frontend)

Paths are relative to `apps/web/src/`. Every route here sits under
`routes/_auth/` and requires a signed-in user.

Every signed-in account can open the directory and creation form, including
`/estates/` and `/estates/new/`, without `canEnterWorkspace`. Creation still checks
`canCreateEstate`; all estate-specific routes retain target-estate capability
guards. Resident-only and unassigned accounts can see an empty directory; Crew see assigned estates
with Create estate. Back, breadcrumb and Cancel on creation all lead to this directory.

## Routes

| File | URL | Params | Title | Renders |
| --- | --- | --- | --- | --- |
| `routes/_auth/estates/index.tsx` | `/estates` | - | "Estates" | `EstateListPage` |
| `routes/_auth/estates/new/index.tsx` | `/estates/new` | - | "Create estate" | `EstateEditorPage` (no `estateId`) |
| `routes/_auth/estates/$estateId/index.tsx` | `/estates/$estateId` | `estateId` | "Estate details" | `EstateDetailsPage`; management readers also mount `LocationsSection` (see [locations.md](locations.md)); Crew receive the read-only summary |
| `routes/_auth/estates/$estateId/edit/index.tsx` | `/estates/$estateId/edit` | `estateId` | "Edit estate" | `EstateEditorPage estateId` |

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `EstateListPage` (`estates/-components/estate-list-page.tsx`) | Search by name/code/address, Status (`ACTIVE` default, `INACTIVE`, `ALL`) and Access (All access/Owner/Shared with you), Create estate and a grid of whole-card details links with name, code, address, ownership and lifecycle badges. | `buttonVariants`, `Card`, `Badge`, `Alert`, `Empty`, `Button`, `Input`, `Label`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` |
| `EstateEditorPage` (`estates/-components/estate-editor-page.tsx`) | Create or edit. Editing requires current ownership or the target estate's `canManageEstate` capability from `useAppAccess`; direct navigation by other roles shows a permission alert with no form. Waits for non-owner permissions and shows an alert if access loading fails. Inactive editing does not reactivate the estate. Creation refreshes access before toast/navigation; a committed creation replaces the form with progress or an alert and Retry access. | `Alert`, `AlertDescription`, `Button` |
| `EstateForm` (`estates/-components/estate-form.tsx`) | Fields: `name` (req, max 200), `code` (req, max 50, "Saved in uppercase"), `address` (req, max 500), `postalCode` (req, max 20), `description` (optional, max 2000). Submit "Create estate" / "Save changes". | `Button`, `Input`, `Label`, `Textarea` |
| `EstateDetailsPage` (`estates/$estateId/-components/estate-details-page.tsx`) | Shows name, Active/Inactive status, code, address, postal code, description. Owners, target-estate Managers and custom EDIT_ESTATE get "Edit estate", including inactive estates. Only the current owner gets "Deactivate estate" while active. Other roles see "Shared with you. You do not have permission to edit estate details." Renders Locations via `children`, followed by an owner-only Assets section with View assets and, while active, Register asset. Owners also get a "Failure risk" link. Load errors and the inactive notice (`role="note"`) are `Alert`s. | `Button`, `buttonVariants`, `Alert`, `AlertDescription` |
| `DeactivateEstateDialog` (`estates/$estateId/-components/deactivate-estate-dialog.tsx`) | Always-open modal; user must type the estate `code` exactly to enable "Deactivate estate". Closing is blocked while pending. | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Input`, `Label` |

## Data (`lib/estates.ts`)

Types: `EstateStatus` = `"ACTIVE" | "INACTIVE" | "ALL"` (from the `list`
operation's `status` query param). Request body `EstateRequest`, response
`EstateResponse` (includes `owned`, `deactivatedAt`).

| Hook / call | Endpoint | Query key | Used by |
| --- | --- | --- | --- |
| `useEstateList(status)` | `GET /estates?status=` | `["estates", userId, "list", status]` | `EstateListPage` |
| `useEstate(estateId?)` | `GET /estates/{id}` | `["estates", userId, "details", estateId]` (disabled without `estateId`) | editor, details, `LocationsSection`, contextual app navigation |
| `useAppAccess()` (`lib/access.ts`) | `GET /access/context` | `[userId, "app-access"]` | editor and details resolve `canManageEstate` for the exact estate ID; ownership still uses `EstateResponse.owned` |

Create/edit mutations use `useSaveEstate` in `lib/estates.ts`. Deactivation
remains inline in the details screen:

| Where | Endpoint | On success |
| --- | --- | --- |
| `useSaveEstate` from `EstateEditorPage` (create) | `POST /estates`, then `GET /access/context` | Retain `createdEstate`; `setQueryData(["estates", userId, "details", data.id])`; invalidate `["estates", userId, "list"]` (all statuses) and `["estates", userId, "dashboard"]`; cancel any older access lookup and refetch `[userId, "app-access"]` with errors propagated; screen callback toasts "Estate created." and navigates to details through the route access guard |
| `useSaveEstate` from `EstateEditorPage` (edit) | `PATCH /estates/{id}` | same; toast "Estate details updated." |
| `EstateDetailsPage` deactivate | `POST /estates/{id}/deactivate` body `{ code }` | `setQueryData(["estates", userId, "details", estateId])`; close dialog; toast; invalidate `["estates", userId, "list"]` and `["estates", userId, "dashboard"]` |

All queries: `enabled` only when `useEstateSession().ready`, `retry: false`,
errors via `estateError`.

`useSaveEstate.refreshAccess` tracks refresh/navigation progress and errors after
the POST has succeeded. A failure shows that the estate was created and offers
Retry access; retry refetches permissions and opens the retained estate ID without
another POST. A rejected POST keeps the original form/input. Editing retains its
existing save flow and does not require the creation refresh step.

Editing and deactivation are separate permissions. Ownership transfer invalidates
estate and app-access queries through `lib/council-invitations.ts`; the former
owner keeps the edit link/form through their retained MANAGER membership and
loses deactivation and transfer controls. Council/Member/Crew/Resident/unassigned
users and Managers of other estates have no editing controls. The API rechecks
authority on save, including after membership removal/demotion.

## Council invitations

Estate details also offers **Device monitoring** to owners and current MANAGER or
COUNCIL assignments, using GET /access/context. A non-owner Manager needs neither
platform-admin authority nor asset visibility. The target is
`/estates/$estateId/sensors`; sensor-specific authorization is enforced by the API.
See [flatlined-sensors.md](flatlined-sensors.md) for screen components and data hooks.

Estate details offers **Council members** when `EstateResponse.canInviteMembers`
or `canManageInvitationPermissions` is true. The route is
`estates/$estateId/council/index.tsx`. Estates mounts `InvitationAcceptance`
for WorkOS email reconciliation and `PendingInvitations` for explicit in-app
acceptance. See [council-invitations.md](council-invitations.md) for components,
hooks, invalidation, and permission behavior.

## Dashboard presentation

All estate screens use `page-layout` and shared `PageHeader`; editors use a narrow
form surface and `FormActions`. Cancel returns to Estates on creation and to the
estate on editing; Save/Cancel disable while saving. Optional fields are labelled
and a form note explains required fields. Details use a responsive `detail-grid`,
LifecycleStatusBadge (green Active / red Inactive) and separate Locations/Assets
surfaces. The same status component is used on estate cards. Council members shares
the wrapping shadcn FieldSet named Estate actions in PageHeader with Edit estate and Deactivate estate when
the caller is permitted; delegates retain Council access without owner actions. Estate-list errors have
Retry; its empty state uses shadcn Empty. Invitations remain independent of the
estate-list request, so their failures do not hide estate cards. See the shared
[design guide](design-system.md); query keys and mutations above are unchanged.

The header has no estate selector. On estate routes, switch directly through
the estate menu in the desktop sidebar or above mobile estate links (see
[shell.md](shell.md)). Estates remains the searchable directory.

## Directory filters and navigation

`estates/index.tsx` wraps EstateListPage with validated URL search from
`-components/estate-directory-filters.ts`: optional `q: string`,
`status: ACTIVE | INACTIVE | ALL`, `access: ALL | OWNED | SHARED`.
EstateListPage receives required `filters` and `onFiltersChange` props; it has
no separate local filter state. The route's URL remains the source of truth.
Unknown statuses/access values default to Active/All access. Query text is
preserved while typing (including spaces); matching trims it and ignores case.
Status remains an API filter; text/access filter the returned accessible rows
locally. Filter edits replace the URL entry, so going back from an opened estate
restores the search and choices without an entry per keystroke.

On phones search spans the row, with status/access together below. Each estate
filter field uses the same label typography, 44px control height and label/control
gap. Field wrappers use flex columns, and the grid aligns them at the bottom so
search and selects line up on desktop. Each estate
card is one real link named `estate name (code)`, with visible keyboard focus
and no nested buttons/links.
Desktop hover adds a subtle accent background, border and shadow; keyboard focus
gets the accent highlight and existing focus ring. Touch users get a pressed
highlight while tapping, rather than depending on hover. Transitions respect
reduced-motion preferences. Badges distinguish Owner from Shared with you,
without implying a council role from general estate access. Clear filters resets
search/access/status to their defaults. No estates and no search/access matches
have separate guidance. Home portfolio analytics are documented in [dashboard.md](dashboard.md).

## Work-order overview entry

EstateDetailsPage includes View work orders in the shadcn Estate actions group
when GET /access/context grants canViewWorkOrders for that estate. It routes to
/estates/$estateId/work-orders and remains visible for inactive history. Access
errors hide the action. Existing overview permissions are unchanged.

## Custom estate permissions

Custom VIEW_ESTATE adds estate list/detail visibility. The exact estate's
canManageEstate (custom EDIT_ESTATE) controls detail editing, including inactive
estates; it never grants ownership. EstateActions exposes Roles when
canViewEstateRoles, and Estate members/invitations when canViewEstateInvitations
or existing invite/admin flags permit. No VIEW_ESTATE means no overview query;
role/invite/report-only users use their own scoped routes. See [estate-roles.md](estate-roles.md).

## Crew inspection entry

Assigned Crew may open a read-only estate overview using canViewEstateDetails.
It exposes Assets/inspection entry and work orders without estate edit, member
administration or the management locations section. Work-order breadcrumbs and
context switching retain the current estate/feature. Existing Owners/Managers
also retain their Devices action on the estate overview, with an Asset categories
action beside it under the same condition ([asset-categories.md](asset-categories.md)).
See [inspections](inspections.md) for limited asset screens and recording.
