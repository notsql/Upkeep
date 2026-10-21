# Flatlined sensors (ID-68)

## Delivery status

The detector, persisted metric policies and maintenance cutoffs, HTTP endpoints,
estate permissions and Device monitoring screen are implemented. The source of truth is
`packages/api/openapi.json`; frontend types are generated. The feature consumes
ID-43 DeviceReading rows without changing ingestion, calling ML or changing asset
condition assessments. See [frontend documentation](../frontend/flatlined-sensors.md),
the feature specification and decision 0030.

## Public API

All four endpoints require a JWT subject and return `Cache-Control: private,
no-store`. The server checks current membership for the target estate on every
request. Owners and current same-estate MANAGER members read/write without a
WorkOS admin claim, unless a conflicting same-estate RESIDENT row exists.
Manager demotion/removal changes permission on the next request with the same
token. Existing compatibility rules remain: JWT ROLE_admin plus a same-estate MEMBER or COUNCIL assignment permits writes;
COUNCIL without admin authority reads only. MEMBER without admin and other known
unauthorized roles receive 403. No assignment/foreign estate returns 404, even
for platform admins. Residency elsewhere does not remove legitimate access.

| Method / path | Request | Response |
| --- | --- | --- |
| GET `/estates/{estateId}/flatline-policies` | Estate UUID | 200 `FlatlinePoliciesResponse`, every metric in catalogue order |
| PUT `/estates/{estateId}/flatline-policies/{metric}` | Estate UUID, DeviceMetric, `SetFlatlinePolicyRequest`; owner/assigned manager | 200 `FlatlinePolicyResponse` |
| GET `/estates/{estateId}/flatlined-sensors` | Estate UUID; optional view=REVIEW or ALL, page=0, size=25 | 200 `FlatlineReviewResponse` |
| POST `/estates/{estateId}/devices/{deviceId}/flatline-pauses/{metric}` | Estate/device UUIDs, DeviceMetric, `CreateFlatlinePauseRequest`; owner/assigned manager | 201 `FlatlinePauseResponse` |

Common errors use `EstateError { message: string }`: 400 invalid DTO, UUID,
metric or pagination; 401 missing identity; 403 insufficient estate role;
404 inaccessible estate or foreign/missing device; 409 inactive estate, retired
target, unsupported/unconfigured metric or active pause; 503 database unavailable.
Unknown routes and unsupported methods stay denied at Spring Security.

### DTOs

All listed fields are present. `?` here means nullable, not optional.
DeviceMetric is TEMPERATURE, HUMIDITY, PRESSURE, FLOW_RATE, VIBRATION,
VIBRATION_ACCELERATION, POWER or ENERGY. Units come from the fixed catalogue.

| DTO | Fields |
| --- | --- |
| SetFlatlinePolicyRequest | durationMinutes: integer, required 1–43200; tolerance: decimal number, required 0–999999999999.999999, at most 6 decimal places |
| CreateFlatlinePauseRequest | durationMinutes: integer, required 1–10080; other fields rejected |
| FlatlinePolicyResponse | metric: DeviceMetric; unit: string; durationMinutes: integer?; tolerance: decimal number |
| FlatlinePoliciesResponse | canManage: boolean; estateActive: boolean; policies: FlatlinePolicyResponse[] |
| FlatlinePauseResponse | deviceId: UUID; metric: DeviceMetric; pausedAt/resumesAt: UTC date-time; pausedByUserId: string |
| FlatlineEvidenceResponse | unchangedSince/lastReadingAt: UTC date-time; observedDurationSeconds: int64; minimumValue/maximumValue/latestValue: decimal numbers |
| SensorMonitoringResponse | deviceId/assetId: UUID; deviceIdentifier/assetName/assetReference: string; assetLocationPath/deviceLocationPath: string; metric: DeviceMetric; unit: string; state: State; lastReadingAt: UTC date-time?; lastValue: decimal number?; thresholdMinutes: integer?; tolerance: decimal number; flatline: FlatlineEvidenceResponse?; pause: FlatlinePauseResponse? |
| FlatlineReviewResponse | checkedAt: UTC date-time; canManage/estateActive/hasSensorReadings: boolean; page/size: integer; totalElements: int64; sensors: SensorMonitoringResponse[] |

Durations reject fractional JSON numbers and strings rather than silently
truncating/coercing them. No default duration is invented for an unconfigured
metric; its displayed tolerance is zero. Request validation repeats UI limits.

State priority is active PAUSED, NOT_CONFIGURED, NO_DATA (no stored reading),
WAITING_FOR_READINGS (stored data but none eligible yet), then FLATLINED or
MONITORING. These states do not certify health. REVIEW includes FLATLINED/PAUSED;
ALL is the inventory used for maintenance before a flag. Filtering precedes paging;
order is device identifier, metric catalogue order, then device UUID. Size is 1–100,
page is nonnegative and offset must fit int32. hasSensorReadings is independent of
view/page and covers current active device/asset/registered-metric attribution.
Inactive estates keep settings readable but return no monitoring rows and reject
writes; retired assets are excluded. An inactive location alone does not exclude
a device. Expired pause metadata remains visible as a fresh-start cutoff.

Each entry includes the asset's and device's **current** full location paths,
ordered from block through level/common area and separated by ` › `, matching
existing asset-path formatting. Paths are identical when their assignments match;
they may differ because the device has its own location. All location ancestors
come from the authorized estate, including inactive locations. Renames/moves appear
on the next review. No extra asset/device-detail permission is required.

For example, a review entry can contain
`"assetLocationPath":"Block A › L2"` and
`"deviceLocationPath":"Block A › L2 › Pump room"`. These are display paths,
not a historical location snapshot or editable request fields.

### Examples

GET policies returns all catalogue entries; a configured temperature entry is
`{"metric":"TEMPERATURE","unit":"°C","durationMinutes":2,"tolerance":0}`;
an unconfigured entry has durationMinutes null and tolerance 0. The wrapper is
`{"canManage":true,"estateActive":true,"policies":[...]}` (array abbreviated).

PUT `…/flatline-policies/TEMPERATURE` with
`{"durationMinutes":2,"tolerance":0.01}` returns
`{"metric":"TEMPERATURE","unit":"°C","durationMinutes":2,"tolerance":0.01}`.

GET `…/flatlined-sensors?view=REVIEW` can return:

```json
{"checkedAt":"2026-10-20T04:00:00Z","canManage":true,"estateActive":true,"hasSensorReadings":false,"page":0,"size":25,"totalElements":0,"sensors":[]}
```

POST `…/devices/{deviceId}/flatline-pauses/TEMPERATURE` with
`{"durationMinutes":60}` returns a 201 response such as:

```json
{"deviceId":"00000000-0000-0000-0000-000000000001","metric":"TEMPERATURE","pausedAt":"2026-10-20T04:00:00Z","resumesAt":"2026-10-20T05:00:00Z","pausedByUserId":"owner"}
```

## Persistence and query behaviour

Prisma models FlatlinePolicy (estate/metric primary key) and DeviceFlatlinePause
(device/metric primary key) are added by `20261020044009_flatline_policies`.
Pauses retain estate/asset attribution, actor and latest expiry; composite foreign
keys keep devices/assets within that estate. Policy upserts retain one row per
metric. Writes lock estate then asset where applicable; a conditional unique-key
pause upsert also rejects concurrent attempts to overwrite an active pause.
Expired rows remain cutoffs and may be replaced by a new pause. No scheduler,
early resume or indefinite pause exists.

Reviews use a repeatable database snapshot and one injected UTC Clock instant.
Location paths use one estate-scoped batch read shared by all device/metric rows,
rather than one lookup per row. There is no location schema change.
Integration tests cover distinct/shared assignments, renamed/inactive locations and
Council/manager access. The location follow-up passed the full 583-test server
suite. Its generated contract came from the actual springdoc handler in a migrated
test context while the regular export plugin remains unavailable offline.
The repository batches current scoped histories in measurement order, uses decimal
arithmetic and excludes future measurements. It does not derive evidence from
lastSeenAt or receipt-time retries. Histories are replayed without an arbitrary
lookback; query cost and memory grow with stored history. Responses remain paginated.
The continuity cutoff supplied to the detector is twice reportingIntervalSeconds.

## Internal contract

Source: `apps/server/src/main/java/com/proj/server/flatline/FlatlineDetector.java`.
It has no Spring component annotation, database access, model call, network
access or wall-clock lookup. Instantiate it directly.

`detect(List<Reading> readings, Policy policy, Instant checkedAt,
Optional<Instant> pauseUntil)` returns `Optional<Run>`.

The caller must supply readings for one device/metric and normalize numeric
values through ingestion before calling. This class does not group devices,
check estate permissions or round raw submitted numbers. FlatlineService scopes
ID-43 history and preserves its stored decimal precision before calling it.

| Input record | Fields |
| --- | --- |
| `Reading` | `measuredAt: Instant`, `value: BigDecimal`, `sensorOrigin: boolean` |
| `Policy` | `threshold: Duration`, `tolerance: BigDecimal`, `maximumGap: Duration` |

Threshold must be at least one minute and a whole number of minutes; tolerance
must be non-negative; maximum gap must be positive. Invalid policy values throw
`IllegalArgumentException`. No product maximum or reporting-interval multiplier
is encoded here. Readings require non-null timestamps/values.

`Run` contains `unchangedSince: Instant`, `lastReadingAt: Instant`,
`latestValue: BigDecimal`, `minimumValue: BigDecimal`, `maximumValue: BigDecimal`.
Its `observedDuration()` returns the duration between the two measurement times.

## Behaviour

1. A pause suppresses the result while `checkedAt < pauseUntil`. Once expired,
   the same timestamp remains a lower bound on eligible measurement time.
2. Exclude manual readings, readings after `checkedAt` and readings before the
   retained pause cutoff. Measurements exactly at expiry are eligible.
3. Order eligible measurements by time without mutating the input. Identical
   numeric values at one timestamp collapse, even with different decimal scale.
   Conflicting values at one eligible timestamp throw `IllegalArgumentException`;
   ID-43 normally rejects those before storage.
4. Track the chronological run's minimum and maximum. A gap strictly greater
   than `maximumGap`, or a numeric range strictly greater than tolerance,
   restarts the run at that measurement. Equality at either limit is allowed.
5. Return only the latest run, and only if at least two distinct measurements
   span at least the threshold. Old flagged runs do not survive newer changed
   readings or a resumed stream after a long gap.

Tolerance 0 means numeric equality, using decimal arithmetic. With positive
tolerance, compare the entire run's maximum minus minimum, not adjacent values;
gradual drift beyond tolerance resets the run.

Passing a later `checkedAt` without new readings cannot grow the observed
duration or create a flag. A previously qualifying latest run remains available
as last-observed evidence during silence. After maintenance, old readings stay
excluded even when they arrive late. The caller must retain the pause cutoff
across requests/restarts and separately provide pause status to the UI.

An empty result is not a healthy-sensor verdict. The caller must distinguish
paused, unconfigured, no-data and non-qualifying states when integrating the
review screen. This detector never changes an asset condition assessment.

Example: three sensor-origin pressure readings of `3.000000`, measured 60
seconds apart over two minutes, qualify with a two-minute threshold, tolerance
0 and maximum gap 60 seconds. A fourth reading of `3.000001` starts a new run
and clears the result until that run has enough measurement evidence.

## Verification

`apps/server/src/test/java/com/proj/server/flatline/FlatlineDetectorTests.java`
contains 29 unit tests, seen failing before implementation and then passing.
They cover duration/tolerance boundaries, numeric scale and precision, gap
limits, manual exclusion, late/future readings, duplicate/conflicting histories,
pause expiry and fresh-start cutoffs. These tests need no Docker, database,
physical sensors or ML model. Additional integration, concurrency and frontend
tests exercise the persisted feature and HTTP/UI contracts.

Verification on 2026-10-18: the targeted 29-test run and Java Spotless check
passed. Workspace web/ML test tasks passed, but the full Java run reported 162
context errors out of 375 tests because `/var/run/docker.sock` was unavailable.
Workspace type-checking failed in the unchanged generated API schema
(`src/schema.ts:608`, TS1131). `pnpm fix` was run; its generated-API formatting
task failed, and its unrelated schema edit was restored. Java formatting passed.
These workspace failures are not evidence of completed full-story validation.

Verification on 2026-10-20: 582 server tests, 315 web tests and 3 simulator tests
passed; type-checking, formatting and the production web build passed. The new
backend feature has 29 detector tests, 42 API cases and one concurrency case.
Initial migration replay and generation used disposable Postgres. The standard
API export task lacked its offline Maven export plugin,
so the real local /v3/api-docs response was exported and openapi-typescript ran
against it. pnpm test's Nx wrapper remains limited by its offline Maven plugin
resolution; the complete direct server and frontend suites passed. Details are
recorded in .spec/features/flatlined-sensors.md.

Follow-up on 2026-10-20: the user configured a Neon child test branch in Infisical.
Prisma/API targets were verified to match; pnpm db:deploy applied six pending
migrations and a subsequent status check confirmed all 16 applied. Three API
scenarios passed against that actual database (settings, device-key flatline and
recovery, pause expiry/fresh start). Fixture data was rolled back. The Prisma
command used the same branch's direct endpoint without editing Infisical; the
browser remains configured for localhost:8080. Restart local dev processes before
manual acceptance testing so they reload the user's changed connections.

## Simulator

Register a fresh temperature device with a 60-second reporting interval and issue
its key. Configure Temperature to 2 minutes and tolerance 0 in Sensors. With the
API running and UPKEEP_DEVICE_KEY set, run:

```bash
python3 scripts/simulate-pump.py --scenario flatline --interval 60 --flatline-minutes 2
# Refresh Sensors to inspect the flatline evidence.
python3 scripts/simulate-pump.py --scenario recovery
# Refresh: the changed measurement starts a new run.
```

These scenarios submit real device-key readings with historical timestamps, without
waiting for the threshold or requiring physical devices. Standard-library simulator
tests cover constant duration, interval boundaries and recovery payloads.
