# Device monitoring (ID-68)

Route: `apps/web/src/routes/_auth/estates/$estateId/sensors/index.tsx`, URL
`/estates/$estateId/sensors`, title Device monitoring. Requires the `_auth` session guard.
All API types come from the generated `@proj/api/schema` contract.
See [API behaviour](../api/flatlined-sensors.md) and decision 0030.

Estate details offers Device monitoring for owners and same-estate MANAGER or
COUNCIL assignments using the existing access projection. A non-owner Manager
does not need `canAccessPlatformAdmin` or asset visibility. The legacy MEMBER
link condition still requires the platform-admin capability, which the current
access projection retires. Sensor checks do not use asset permissions. Backend
checks remain authoritative on every request, and policy/review `canManage`
responses determine whether edit and pause controls appear.

## Route-local components (`sensors/-components/`)

| File / component | Behaviour / shadcn components |
| --- | --- |
| sensors-page.tsx / SensorsPage, SensorReviewResults | PageHeader, view selection, checked time, refresh, paging, errors/retry and distinct empty states; Select, Button, Alert |
| sensor-monitoring-table.tsx / SensorMonitoringTable, SensorRow | Desktop table or a divided mobile list below 768px; shared device/asset identity, metric/unit, textual state, observed duration/range, last measurement and maintenance cutoff/actions; Table, Badge, Button |
| metric-policy-settings.tsx / MetricPolicySettings | Collapsible Metric policies section with configured count, metric/unit, saved threshold/tolerance, Configured/Not set badge, and Edit/Set up/Close buttons; table on desktop, stacked rows on mobile; one inline editor, read-only for Council/inactive estates; Table, Badge, Button |
| metric-policy-form.tsx / MetricPolicyForm, useMetricPolicyEditor | Expanded per-metric editor, whole minutes/hours and nonnegative tolerance shared estate-wide; Cancel and Save policy; draft/validation/mutation state is owned by the summary component through the hook; Field, Input, Select, Alert, Button |
| pause-sensor-dialog.tsx / PauseSensorDialog | Finite pause for one device/metric, seven-day maximum, automatic expiry/fresh-start explanation; Dialog, Field, Input, Select, Alert, Button |
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

Within the expanded section, policy editors start closed. Edit/Set up opens one editor directly beneath the selected
metric, before the next metric: inside that mobile list entry, or in the immediately
following full-width desktop table row. Its heading receives focus and scrolls into
view. Close/Cancel discards unsaved edits
without a request and returns focus to the summary action. Switching metrics opens
the newly selected editor. A successful save invalidates the existing keys,
refreshes the summary and closes the editor; failures preserve input. While saving,
closing/switching and duplicate submission are blocked. Polling updates saved
summaries without replacing the open draft. Draft/validation and mutation state live
above the responsive branches, so moving the form between list/table rows retains
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
