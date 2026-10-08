# Estates (frontend)

Paths are relative to `apps/web/src/`. Every route here sits under
`routes/_auth/` and requires a signed-in user.

## Routes

| File | URL | Params | Title | Renders |
| --- | --- | --- | --- | --- |
| `routes/_auth/estates/index.tsx` | `/estates` | - | "Estates" | `EstateListPage` |
| `routes/_auth/estates/new/index.tsx` | `/estates/new` | - | "Create estate" | `EstateEditorPage` (no `estateId`) |
| `routes/_auth/estates/$estateId/index.tsx` | `/estates/$estateId` | `estateId` | "Estate details" | `EstateDetailsPage` with `LocationsSection` as children (see [locations.md](locations.md)) |
| `routes/_auth/estates/$estateId/edit/index.tsx` | `/estates/$estateId/edit` | `estateId` | "Edit estate" | `EstateEditorPage estateId` |

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `EstateListPage` (`estates/-components/estate-list-page.tsx`) | Status filter (`ACTIVE` default, `INACTIVE`, `ALL`), "Create estate" link, grid of estate cards (name links to details; badges "Shared with you" when `!owned`, and Active/Inactive). Empty state text differs for `ALL`. | `buttonVariants`, `Card`, `Badge`, `Alert`, `Empty`, `Button`, `Label`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` |
| `EstateEditorPage` (`estates/-components/estate-editor-page.tsx`) | Create or edit. When editing, loads the estate and notes that editing an inactive estate does not reactivate it. On save: toast, navigate to `/estates/$estateId`. | - |
| `EstateForm` (`estates/-components/estate-form.tsx`) | Fields: `name` (req, max 200), `code` (req, max 50, "Saved in uppercase"), `address` (req, max 500), `postalCode` (req, max 20), `description` (optional, max 2000). Submit "Create estate" / "Save changes". | `Button`, `Input`, `Label`, `Textarea` |
| `EstateDetailsPage` (`estates/$estateId/-components/estate-details-page.tsx`) | Shows name, Active/Inactive status, code, address, postal code, description. Owner-only actions: "Edit estate" link and, while active, "Deactivate estate" button. Non-owners see "Shared with you. Only the owner can change this estate." Renders Locations via `children`, followed by an owner-only Assets section with View assets and, while active, Register asset. | `Button`, `buttonVariants` |
| `DeactivateEstateDialog` (`estates/$estateId/-components/deactivate-estate-dialog.tsx`) | Always-open modal; user must type the estate `code` exactly to enable "Deactivate estate". Closing is blocked while pending. | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Input`, `Label` |
| `EstateSwitcher` (`components/estates/estate-switcher.tsx`) | Header select of **active** estates. Selected value: the estate in the URL, else the one remembered in `localStorage["upkeep:current-estate"]`, if still in the list. Changing it remembers the choice and navigates to `/estates/$estateId`. Renders nothing when the list is empty. | `Label`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` |

## Data (`lib/estates.ts`)

Types: `EstateStatus` = `"ACTIVE" | "INACTIVE" | "ALL"` (from the `list`
operation's `status` query param). Request body `EstateRequest`, response
`EstateResponse` (includes `owned`, `deactivatedAt`).

| Hook / call | Endpoint | Query key | Used by |
| --- | --- | --- | --- |
| `useEstateList(status)` | `GET /estates?status=` | `["estates", userId, "list", status]` | `EstateListPage`, `EstateSwitcher` (`"ACTIVE"`) |
| `useEstate(estateId?)` | `GET /estates/{id}` | `["estates", userId, "details", estateId]` (disabled without `estateId`) | editor, details, `LocationsSection`, contextual app navigation |

Mutations are defined inline in the screens (not in `lib/estates.ts`):

| Where | Endpoint | On success |
| --- | --- | --- |
| `EstateEditorPage` save (create) | `POST /estates` | `setQueryData(["estates", userId, "details", data.id])`; invalidate `["estates", userId, "list"]` (all statuses); toast "Estate created."; navigate to details |
| `EstateEditorPage` save (edit) | `PATCH /estates/{id}` | same; toast "Estate details updated." |
| `EstateDetailsPage` deactivate | `POST /estates/{id}/deactivate` body `{ code }` | `setQueryData(["estates", userId, "details", estateId])`; close dialog; toast; invalidate `["estates", userId, "list"]` |

All queries: `enabled` only when `useEstateSession().ready`, `retry: false`,
errors via `estateError`.

## Council invitations

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
the wrapping shadcn FieldSet named Estate actions with Edit estate and Deactivate estate when
the caller is permitted; delegates retain Council access without owner actions. Estate-list errors have
Retry; its empty state uses shadcn Empty. Invitations remain independent of the
estate-list request, so their failures do not hide estate cards. See the shared
[design guide](design-system.md); query keys and mutations above are unchanged.
