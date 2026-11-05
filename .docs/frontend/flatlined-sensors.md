# Device monitoring (ID-68)

Routes (folder-based, under `apps/web/src/routes/_auth/estates/$estateId/sensors/`):

| File | URL | Title | Renders |
| --- | --- | --- | --- |
| `route.tsx` | layout for both below | - | `SensorsLayout` around an `Outlet` |
| `index.tsx` | `/estates/$estateId/sensors` | Device monitoring | `SensorsView view="REVIEW"` (Needs review) |
| `all/index.tsx` | `/estates/$estateId/sensors/all` | All device metrics | `SensorsView view="ALL"` |

Requires the `_auth` session guard; `/sensors/all` shares the `/sensors` gate
(`SUB_VIEW_SECTIONS` in `routes/_auth/route.tsx`).
All API types come from the generated `@proj/api/schema` contract.
See [API behaviour](../api/flatlined-sensors.md) and decision 0030.

The sidebar's Assets › Device monitoring (`canOpenSensors` in `lib/estate-destinations.ts`, also enforced by the `_auth` guard) is shown for owners and same-estate MANAGER or
COUNCIL assignments using the existing access projection. A non-owner Manager
does not need `canAccessPlatformAdmin` or asset visibility. The legacy MEMBER
condition still requires the platform-admin capability, which the current
access projection retires. Sensor checks do not use asset permissions. Backend
checks remain authoritative on every request, and policy/review `canManage`
responses determine whether edit and pause controls appear.

## Route-local components (`sensors/-components/`)

| File / component | Behaviour / shadcn components |
| --- | --- |
| sensors-layout.tsx / SensorsLayout | `ListPageHeader` (`Gauge`, "Flatline review, policies and pauses"; no filters or create), a short muted note on what a possible flatline means, and a `SubNav` ("Device metric views": Needs review → `/sensors` (exact), All device metrics → `/sensors/all`) above the child view |
| sensors-page.tsx / SensorsView; sensor-review-results.tsx / SensorReviewResults | One view: `LoadingState` / `ErrorState` ("Retry metric policies") for policies; inactive-estate `Alert`; a "Device metrics" `SectionCard` (no icon; header action outline "Refresh readings") holding `LoadingState`, `ErrorState` ("Retry device metrics"), checked time, the table and distinct `EmptyState`s, then the shared `Pagination` ("Device metric pages", summary "Page N · T device metrics", 25 per page); then `MetricPolicySettings` and the pause dialog. Page state is per view |
| sensor-monitoring-table.tsx / SensorMonitoringTable; sensor-row.tsx / SensorRow | Desktop table or a divided mobile list below 768px; shared device/asset identity, metric/unit, textual state, observed duration/range, last measurement and maintenance cutoff/actions; Table, Badge, Button |
| metric-policy-settings.tsx / MetricPolicySettings | Collapsible Metric policies section with configured count, metric/unit, saved threshold/tolerance, Configured/Not set badge, and Edit/Set up buttons; table on desktop, stacked rows on mobile; Edit/Set up (ghost) opens the editor Dialog, read-only for Council/inactive estates; Table, Badge, Button |
| metric-policy-form.tsx / MetricPolicyDialog; use-metric-policy-editor.ts / useMetricPolicyEditor | `MetricPolicyDialog`: the shared `FormDialog` (title "<Metric> policy", description the current threshold; fields Threshold, Time unit, Tolerance) with Cancel and "Save policy" ("Saving…" while pending, no dismissal); whole minutes/hours and nonnegative tolerance shared estate-wide; validation and save errors show as the dialog's `role="alert"` line. If management is lost mid-edit (e.g. the review fails to load) the draft stays, fields disable and saving is blocked with "Saving is paused until device metrics load" ("Save policy" disabled via `submitDisabled`). Draft/validation/mutation state is owned by the summary component through the hook; FormDialog, Field, Input, Select |
| pause-sensor-dialog.tsx / PauseSensorDialog | `FormDialog` "Pause <device> <metric>": finite pause for one device/metric, seven-day maximum, automatic expiry/fresh-start explanation; fields Pause duration and Time unit; "Start pause" / "Starting pause…"; errors keep the chosen duration; FormDialog, Field, Input, Select |
| sensor-format.ts | Metric/time labels and integer minutes/hours conversion with bounds/overflow validation |

Needs review is the initial view (flatlined/paused). All device metrics also includes
unconfigured/no-data/monitoring devices and permits maintenance before a flag.
Page/view controls say All device metrics, Device metrics and Metric policies;
the maintenance action remains Pause for maintenance. Each row is one device and
metric, rather than a separately registered sensor. Pages contain 25 entries.
Previous page remains available if the current page
empties after another manager changes results.

The UI says Possible flatline and explains that silence is not unchanged-reading
evidence. Server PAUSED state controls active-pause display; an expired cutoff
remains visible. No browser expiry write occurs. Last-reading time and frozen
duration expose stale observations. Asset names are plain text so manager/Council
readers are not linked into owner-only asset pages. The identity section shows the
full location path. Matching asset/device locations use one Location line; distinct
assignments use Asset location and Device location lines. Both strings come from
the review response, with no extra location/asset/device requests.

Fields have associated labels, dialogs have names/descriptions, and state uses
text as well as colour. The existing `useMobile` hook mounts one device-metric presentation
and one policy summary presentation below/above 768px, from the same query data.
Mobile device-metric entries retain every evidence field and maintenance action, wrap long
identifiers and dates, and use a full-width pause button. Desktop tables retain the
shared keyboard-reachable overflow region. Policy fields and actions stack on
phones; the summary uses rows rather than separate always-open form cards.

The Metric policies section starts collapsed. Its shadcn Button header retains the
title, estate-wide threshold/tolerance description and configured count. A chevron
indicates expansion; aria-expanded/aria-controls expose it to assistive technology,
and the subtitle/count describe the button. The header wraps the count below its
title on narrow screens. Hidden contents stay mounted to preserve the draft and
validation when collapsing/reopening; the header disables while saving.

Within the expanded section, Edit/Set up opens the editor in a modal Dialog named
"<Metric> policy" (one at a time, on mobile and desktop). Cancel, X or Escape
discards unsaved edits
without a request and returns focus to the summary action. A successful save invalidates the existing keys,
refreshes the summary and closes the editor; failures preserve input. While saving,
Cancel, X and Escape are blocked and duplicate submission is prevented. Polling updates saved
summaries without replacing the open draft. Draft/validation and mutation state live
above the responsive branches, so a switch between list/table layouts retains
entered values and an in-progress save. Council/inactive estates have no edit or pause actions. If
review access becomes unavailable while editing, preserve the draft in disabled
fields and remove Save until a successful retry restores the required capability.
Loading/errors never fabricate zero counts. Tolerance is labelled as a total range,
not a plus/minus deviation; detection, policies and maintenance rules are unchanged.

## Hooks (`apps/web/src/lib/flatlined-sensors.ts`)

Calls use the typed client/token bridge and explicitly throw estateError on API
failure. Queries pass React Query abort signals, wait for useAuthenticatedSession,
and use user-first keys. That session hook cancels/removes the old account's cache.

| Hook | Endpoint | Key / invalidation |
| --- | --- | --- |
| useFlatlinePolicies(estateId) | GET /estates/{estateId}/flatline-policies | [userId,"flatline",estateId,"policies"] |
| useFlatlineReview(estateId,view,page) | GET /estates/{estateId}/flatlined-sensors?view=&page=&size=25 | [userId,"flatline",estateId,"review",view,page,25] |
| useSetFlatlinePolicy(estateId,metric) | PUT /estates/{estateId}/flatline-policies/{metric} | Success invalidates [userId,"flatline",estateId] |
| usePauseFlatlineSensor(estateId,sensor) | POST /estates/{estateId}/devices/{deviceId}/flatline-pauses/{metric} | Same prefix invalidation; success closes dialog |

Both queries refresh every 60 seconds while visible, on focus and after successful
mutations; no automatic retries. View changes reset to page zero. Every view/page
has its own cache entry. Successful policy/review canManage and estateActive flags
gate mutation controls. Backend validation and authorization repeat every check.

This screen does not implement ML, gap alerts, asset-condition changes, raw history,
notifications, pause extension or early resume.

## Design-system pass

`Gauge` appears once, in the `ListPageHeader` (it was repeated on the section heading and every
empty state). "Device metrics" is a `SectionCard` with no icon; Metric policies keeps its
`SlidersHorizontal`. Empty states use the default `Inbox`. Row Pause buttons are
`ghost`. Empty states are fragments: "Monitoring unavailable" / "Estate inactive",
"No devices yet", "No device readings yet" / "See All device metrics", "Nothing
needs review", "No device metrics on this page" / "Go back a page".
