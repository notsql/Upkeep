# Estates (frontend)

Paths are relative to `apps/web/src/`. Every route here sits under
`routes/_auth/` and requires a signed-in user.

Every signed-in account can open the directory and creation form, including
`/estates/` and `/estates/new/`, without `canEnterWorkspace`. Creation still checks
`canCreateEstate`; all estate-specific routes retain target-estate capability
guards. Resident-only and unassigned accounts can see an empty directory; Crew see assigned estates
with Create estate. The breadcrumb and Cancel on creation lead to this directory.
`/estates` is the single "All estates" landing (directory + pending
invitations), reached from the header switcher's "All estates" and from the
signed-in `/` redirect: exactly one membership goes to that estate's
destination, zero or several to `/estates` (resident-only accounts get the
resident dashboard; see [shell.md](shell.md)).

## Routes

| File | URL | Params | Title | Renders |
| --- | --- | --- | --- | --- |
| `routes/_auth/estates/index.tsx` | `/estates` | - | "Estates" | `EstateListPage` |
| `routes/_auth/estates/new/index.tsx` | `/estates/new` | - | "Create estate" | `EstateEditorPage` (no `estateId`) |
| `routes/_auth/estates/$estateId/index.tsx` | `/estates/$estateId` | `estateId` | "Estate overview" | `EstateDetailsPage` (the dashboard). Locations moved to `/estates/$estateId/locations` (see [locations.md](locations.md)) |
| `routes/_auth/estates/$estateId/edit/index.tsx` | `/estates/$estateId/edit` | `estateId` | "Estate settings" | `EstateEditorPage estateId` (edit form, then owner-only Danger zone); guarded by `canOpenEstateSettings` (`owned \|\| canManageEstate`) |

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `EstateListPage` (`estates/-components/estate-list-page/estate-list-page.tsx`) | Search by name/MCST number/address (placeholder "Search by name, MCST number or address"), Status (`ACTIVE` default, `INACTIVE`, `ALL`) and Access (All access/Owner/Shared with you) in the retractable `FilterBar` "Filter estates" (collapsed by default; opens on load when the URL carries filters) toggled from `ListPageHeader`'s Filters button, `CreateButton` "Create" (to `/estates/new`), result count (inside the filter panel), Skeleton loading and a grid of whole-card details links with name, MCST number (`MCST <code>`), address, ownership and lifecycle badges; each card has an initials monogram tile tinted from the brand scale (`brand-1`/`brand-2`/`brand-3`, chosen by a hash of the estate ID). Empty states use `EmptyState` with `Building2` (no estates) or `SearchX` (no matches); pending invitations empty uses `MailOpen`. State and filter handlers live in `use-estate-list-page.ts`. | `buttonVariants`, `Card`, `Badge`, `Alert`, `Empty` (+`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent`), `Button`, `InputGroup`, `InputGroupAddon`, `InputGroupInput`, `Skeleton`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` |
| `EstateEditorPage` (`estates/-components/estate-editor-page/estate-editor-page.tsx`) | `FormPage` (`icon={Building2}`, description "Identity and address"; loading, errors and the permission alert render inside it): create ("Create estate", breadcrumbs `Estates › Create estate`) or edit ("Estate settings", no breadcrumbs). In edit mode, after the form, an `EstateDangerZone` `Card` (below the form card in the same `grid gap-6`) titled "Danger zone" (OctagonAlert icon in `text-destructive`) with a destructive "Deactivate estate" button opening `DeactivateEstateDialog`, shown only when `estate.owned` and the estate is active. Editing requires current ownership or the target estate's `canManageEstate` capability from `useAppAccess`; direct navigation by other roles shows a permission alert with no form. Waits for non-owner permissions and shows an alert if access loading fails. Inactive editing does not reactivate the estate. Creation refreshes access before toast/navigation; a committed creation replaces the form with progress or an `ErrorState` with Retry access. | `Alert`, `AlertDescription`, `Button`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` |
| `EstateForm` (`estates/-components/estate-editor-page/estate-form/estate-form.tsx`) | Fields: `name` (req, max 200), `code` labelled "MCST number" (req, max 50, placeholder "e.g. 1234", `inputMode="numeric"`, hint asks for the number only without "MCST"), `address` (req, max 500), `postalCode` (req, max 20), `description` (optional, max 2000). Submit "Create estate" / "Save changes". Name/MCST fields are `estate-form-identity-fields.tsx`; address/postal code are `estate-form-address-fields.tsx`. | `Button`, `Input`, `Label`, `Textarea` |
| `EstateDetailsPage` (`estates/$estateId/-components/estate-details-page/estate-details-page.tsx`) | The estate overview dashboard: `PageHeader` (estate name, `LifecycleStatusBadge`, description; action: an outline "Estate settings" link to `/estates/$estateId/edit` for owners and `canManageEstate`), a compact `dl` line (MCST number, address, postal code), the inactive `Alert` (`role="note"`), the shared read-only note for non-editors, then `EstateDashboard`. No inline forms: editing lives in Estate settings. Load errors are `Alert`s. | `Alert`, `Button` (variants) |
| `EstateDashboard` (`estates/$estateId/-components/estate-details-page/estate-dashboard.tsx`) | Stat row of `SummaryCard`s (icon tile switches to `warning` tone when non-zero): "Open work orders" (non-CLOSED in the newest page of 20; urgent count, or "Among the latest 20" when more pages exist), "Overdue inspections" (`overdueCount`, due this month), "Offline devices" (online count), "Flagged assets". Then list `Card`s (`role="region"`, up to 5 rows, footer link to the full screen): "Open work" (links to work-order detail, priority `Badge` toned by `reportUrgencyTone`), "Recent fault reports" (links to report detail, status `Badge` labelled and toned by `workOrderStatusLabel`/`workOrderStatusTone`, outline raw value if unknown), "At-risk assets" (links to asset detail). Each section is mounted only when its `lib/estate-destinations.ts` predicate passes (`dashboardAccess`), so unpermitted endpoints are never called. | `Card`, `Badge`, `SummaryCard` |
| `DeactivateEstateDialog` (`estates/$estateId/-components/deactivate-estate-dialog.tsx`) | Always-open modal; user must type the stored estate `code` exactly (field labelled "MCST number") to enable "Deactivate estate" (shared `ConfirmDialog` with `confirmDisabled`; "Deactivating…" while pending). Closing is blocked while pending. | `ConfirmDialog`, `Input`, `Label` |

## Data (`lib/estates.ts`)

Types: `EstateStatus` = `"ACTIVE" | "INACTIVE" | "ALL"` (from the `list`
operation's `status` query param). Request body `EstateRequest`, response
`EstateResponse` (includes `owned`, `deactivatedAt`).

| Hook / call | Endpoint | Query key | Used by |
| --- | --- | --- | --- |
| `useEstateList(status)` | `GET /estates?status=` | `["estates", userId, "list", status]` | `EstateListPage` |
| `useEstate(estateId?)` | `GET /estates/{id}` | `["estates", userId, "details", estateId]` (disabled without `estateId`) | editor, details, `LocationsSection`, sidebar (`owned`), and the `_auth` owner-gated route guards via `ensureQueryData` |
| `useAppAccess()` (`lib/access.ts`) | `GET /access/context` | `[userId, "app-access"]` | editor and details resolve `canManageEstate` for the exact estate ID; ownership still uses `EstateResponse.owned` |

Create/edit mutations use `useSaveEstate` in `lib/estates.ts`. Deactivation
is inline in `EstateDangerZone` on Estate settings:

| Where | Endpoint | On success |
| --- | --- | --- |
| `useSaveEstate` from `EstateEditorPage` (create) | `POST /estates`, then `GET /access/context` | Retain `createdEstate`; `setQueryData(["estates", userId, "details", data.id])`; invalidate `["estates", userId, "list"]` (all statuses); cancel any older access lookup and refetch `[userId, "app-access"]` with errors propagated; screen callback toasts "Estate created." and navigates to details through the route access guard |
| `useSaveEstate` from `EstateEditorPage` (edit) | `PATCH /estates/{id}` | same; toast "Estate details updated." |
| `EstateDangerZone` deactivate (`/edit`) | `POST /estates/{id}/deactivate` body `{ code }` | `setQueryData(["estates", userId, "details", estateId])`; close dialog; toast "Estate deactivated. Existing records have been preserved."; invalidate `["estates", userId, "list"]` |

All queries: `enabled` only when `useEstateSession().ready`, `retry: false`,
errors via `estateError`.

`useSaveEstate.refreshAccess` tracks refresh/navigation progress and errors after
the POST has succeeded. A failure shows that the estate was created and offers
Retry access; retry refetches permissions and opens the retained estate ID without
another POST. A rejected POST keeps the original form/input. Editing retains its
existing save flow and does not require the creation refresh step.

Editing and deactivation are separate permissions. Ownership transfer invalidates
estate and app-access queries through `lib/council-invitations.ts`; the former
owner keeps Estate settings through their retained MANAGER membership and
loses deactivation and transfer controls. Council/Member/Crew/Resident/unassigned
users and Managers of other estates have no editing controls. The API rechecks
authority on save, including after membership removal/demotion.

## Council invitations

Device monitoring (`/estates/$estateId/sensors`) is a sidebar item under Assets,
shown by `canOpenSensors` (owners, and MANAGER/COUNCIL with management access).
See [flatlined-sensors.md](flatlined-sensors.md).

The sidebar's Administration › **People & access** item opens the council page when
`canOpenMembers` is true (otherwise Roles). The route is
`estates/$estateId/council/index.tsx`. Estates mounts `InvitationAcceptance`
for WorkOS email reconciliation and `PendingInvitations` for explicit in-app
acceptance, both at the very top of the page above the "Estates" PageHeader
(Firebase-console style banners), followed by filters and the estate grid. See [council-invitations.md](council-invitations.md) for components,
hooks, invalidation, and permission behavior.

## Dashboard presentation

All estate screens use `PageLayout` and shared `PageHeader`; editors use `FormPage`,
a `FormCard` and `FormActions` ([design-system.md#forms-formpage-formcard-formactions](design-system.md#forms-formpage-formcard-formactions)). `EstateForm` groups
fields into `FieldSet`s "Identity" (name, MCST number) and "Address" (address,
postal code, description (optional)) split by a `FieldSeparator`; errors are a
destructive `Alert`. Cancel returns to Estates on creation and to the
estate on editing; Save/Cancel disable while saving. Optional fields are labelled
and a form note explains required fields. Details use a responsive `DetailCard`,
LifecycleStatusBadge (Badge `default` Active / `destructive` Inactive) and the
Locations surface. The same status component is used on estate cards. Estate-list errors have
Retry; its empty state uses shadcn Empty. Invitations remain independent of the
estate-list request, so their failures do not hide estate cards. See the shared
[design guide](design-system.md); query keys and mutations above are unchanged.

Estates are switched with the header estate switcher (see
[shell.md](shell.md)); its menu also links to All estates and, if allowed,
Create estate. On `/estates` and `/estates/new` it reads "Select estate", and
both render full width with no sidebar.

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

The filters are the shared `FilterBar` (search landmark "Filter estates"): an
`InputGroup` search (leading Search icon, accessible name "Search estates") and
the Status and Access `Select`s (`Field w-full sm:w-48`, trigger `w-full`,
accessible names via `aria-label`), stacking on phones. `activeCount` counts
search, non-default Access and non-default Status, so the header shows "N
active" and the bar's ghost Clear filters (`onClear` resets all three); the
actions hold only the result count ("1 estate" / "N estates"). While loading,
`LoadingState` "Loading estates…" renders three skeleton cards (`cards`). Cards sit in a 1/2/3-column grid (base/sm/lg). Each
card is one real link named `estate name (MCST code)`, with visible keyboard focus
and no nested buttons/links. It shows a monogram tile (initials, colour derived
from the estate id), name, monospace `MCST <code>`, address with a MapPin icon, and the
Owner/Shared with you and lifecycle badges; hover adds a ring, shadow and a
chevron. Transitions respect reduced-motion preferences. The empty state is the shared
`EmptyState` (no icon): with default filters it says "No active
estates" (or the ALL/INACTIVE variant) with "Use Create to add the first
estate" and no action (the header Create is the entry point); with filters
active it says "No matching estates"
("Try another search or access filter" / "No inactive estates") with
an outline "Clear filters" (the FilterBar keeps its own ghost one). A failed
list is `ErrorState` "Retry estates". `ListPageHeader` "Estates" uses
`icon={Building2}`, description "Estates you own or can access".

## Custom estate permissions

Custom VIEW_ESTATE adds estate list/detail visibility. The exact estate's
canManageEstate (custom EDIT_ESTATE) controls detail editing, including inactive
estates; it never grants ownership. The sidebar shows People & access when
canViewEstateRoles, or when canViewEstateInvitations or existing
invite/admin flags permit. No VIEW_ESTATE means no overview query;
role/invite/report-only users use their own scoped routes. See [estate-roles.md](estate-roles.md).

## Crew inspection entry

Assigned Crew may open a read-only estate overview using canViewEstateDetails.
Their sidebar exposes Assets (inspection entry) and Work orders, without Estate
settings, member administration or the management locations section. Inspections
(with its Check schedules tab) is a sidebar item for owners and
`canManageInvitationPermissions` delegates ([check-schedules.md](check-schedules.md),
[inspection-list.md](inspection-list.md)).
See [inspections](inspections.md) for limited asset screens and recording.

## MCST number display

Estates are Singapore condominiums; the API field `code` holds the MCST
(Management Corporation Strata Title) number, stored without the prefix.
`formatMcst(code)` in `apps/web/src/lib/estates.ts` renders `MCST <code>`
and leaves codes that already start with "MCST" (case-insensitive) as-is.
It is used on estate cards, the details page and admin member estates.

## Screen states in other estate screens

- Estate editor (edit mode): `LoadingState` "Loading estate…" while the estate
  or permissions load.
- Estate details: `LoadingState` "Loading estate…"; dashboard cards with no
  rows show `EmptyState` "Nothing to show" (default Inbox). Stat cards use the
  section icons (Wrench, ClipboardCheck, Cpu, AlertTriangle); list cards use
  distinct ones so no icon repeats: Open work `History`, Recent reports
  `ClipboardList`, At-risk assets `Flag`. The details PageHeader
  uses `icon={LayoutDashboard}`; the "Estate settings" link leads with Settings.
- Estate editor: `FormPage` (no icon), description "Identity and
  address"; Danger zone title has an OctagonAlert icon. `DeactivateEstateDialog`
  stays a hand-built Dialog: its confirm must stay disabled until the MCST
  number is typed, which `ConfirmDialog` cannot express yet.
- `PendingInvitations` with `showEmpty`: `EmptyState` "No pending invitations"
  (default Inbox). Load failures in `PendingInvitations` and
  `InvitationAcceptance` are `ErrorState` ("Retry pending invitations",
  "Retry invitations").
