# Detect flatlined sensors

**Status:** implemented; direct suites verified; Nx offline-tooling limitation documented
**Owner:** Chan Ding Jie
**Jira:** [ID-68](https://notjira.atlassian.net/browse/ID-68)
**Integration revision:** 2026-10-20

### Review decisions (2026-10-20)

- Latest UI refinement: the user requested the reference's collapsible policy
  header. Use Device monitoring for the page/navigation, Metric policies for the
  section/editor wording, and retain All device metrics/Pause for maintenance.
  Policies start collapsed; keep title, explanatory subtitle and configured count
  visible. Expand/collapse with one labelled keyboard-accessible button and a
  chevron. Keep drafts when collapsing/reopening and disable collapse during a
  save. Expanded editors stay immediately below their selected metric row.
- The user requested consistent UI labels: Monitoring Device, All device metrics,
  Monitoring rules, and Pause for maintenance. Use device/metric wording in the
  page, navigation, forms and feedback; retain existing internal route/API names.
  Include the asset's full location path beneath its identity in desktop/mobile
  monitoring rows. A device may be registered at another location: show both
  Asset location and Device location when they differ, otherwise one Location.
  Add required string fields assetLocationPath/deviceLocationPath to each review
  entry, computed in the same authorized estate snapshot, including inactive
  locations. Batch location reads; do not call owner-only asset/device endpoints
  from this screen. No database migration or permission expansion is required.
- During manual acceptance, the user requested the attached summary-table design
  with expandable metric settings, replacing the always-visible policy cards.
  Keep the same rules, endpoints and permissions. Show configured count, metric,
  saved threshold/tolerance and status; Edit/Set up opens one inline editor
  directly below its selected metric, before the following metric. The user
  clarified this placement after the first responsive UI pass so mobile users
  do not need to scroll to the bottom of the list.
  Cancel discards that editor's draft; failures and background refresh retain it;
  successful saving closes it. Prevent closing/switching while saving. Council
  and inactive estates see summaries without mutation controls. On phones, use
  compact stacked policy rows and a sensor list preserving all evidence and
  maintenance actions, rather than requiring horizontal table scrolling. Use the
  existing responsive hook and shadcn primitives, with keyboard-labelled controls.
- The user accepted the threshold range after clarifying its meaning and
  confirmed that owners/assigned managers can edit metric settings while
  Council remains read-only.
- The user accepted restarting the run for a measurement gap strictly greater
  than twice the expected reporting interval. This is a continuity check for
  ID-68, not a second ID-67 reporting-gap alert. Silence itself cannot extend
  a flatline. Align terminology with ID-67 without making its UI a dependency.
- The user accepted the seven-day maximum maintenance pause. It is a maximum,
  not a default pause duration. This settles the remaining product choice;
  the integration work can follow the TDD phases below after technical checks.

## Problem

A sensor can continue sending measurements while its value is stuck. Managers
need possible flatlines surfaced automatically, so unchanged data is not mistaken
for evidence that an asset is healthy. A flatline is a pattern needing review,
not proof that either the sensor or asset has failed.

## Delivery status and dependencies

- The pure Java FlatlineDetector and 29 unit tests were implemented test-first
  on 2026-10-18. They are documented in
  [.docs/api/flatlined-sensors.md](../../.docs/api/flatlined-sensors.md).
  The historical targeted run and Java formatting passed. That day's full
  checks were not green: Docker was unavailable and the generated API schema
  had a type-check/formatting failure. These are historical results, not
  verification of the new merged main.
- Reviewed main at ad846dc on 2026-10-20 includes ID-43, authenticated
  POST /device-api/readings, DeviceReading storage, generated jOOQ/API sources
  and scripts/simulate-pump.py. Do not recreate or modify its ingestion rules.
- ID-43 stores numeric(18,6), rounded half-up, and UTC measurement timestamps
  at microsecond precision. Identical retries create no row, conflicting values
  for one device/metric/time are rejected, and valid late readings are accepted.
- DeviceReading contains device-key submissions only. Querying it excludes
  manual entry by construction; no ID-64 source-field migration is needed now.
  Any future manual-reading integration must preserve this boundary.
- No dependency on ID-60's general reading browser or any ML model. Spring now
  runs the pump anomaly model in process; ID-68 never calls it.
- Coordinate continuity terminology with ID-67. The user-approved multiplier
  below is ID-68's continuity rule, not a claim that ID-67 implements that same
  alert threshold or that ID-68 should duplicate gap warnings.
- The agreed integration is implemented: Prisma policies/pauses and generated
  jOOQ, estate authorization, four HTTP endpoints and generated OpenAPI/TypeScript,
  the Sensors screen and constant/recovery simulator scenarios. Migrations and
  initial generation used disposable local Postgres. The user subsequently
  configured a Neon child test branch; its migration/smoke verification is
  recorded below. Infisical settings were changed by the user, not by this feature.
  As-built details live in .docs/api/flatlined-sensors.md and
  .docs/frontend/flatlined-sensors.md. Final verification is recorded below.

## Behaviour

### Agreed product rules

1. Policies are shared per metric within an estate. A device automatically uses
   the policy for each supported metric; evaluate each device/metric separately.
   Do not change metric names/units or introduce manual sensor groups.
2. Configure a metric before detection runs. Unconfigured metrics still accept
   readings. No default duration and no estate-wide disable switch are provided.
3. Tolerance defaults to 0, meaning exact numeric equality after ID-43's rounding.
   Authorized users can set a non-negative tolerance in the metric's unit.
   Compare a run's maximum minus minimum, not only adjacent readings.
4. Both threshold and pause inputs accept whole-number minutes or hours, with
   a one-minute minimum. An hour and a half is entered as 90 minutes.
5. A run needs at least two distinct measurement timestamps and an observed
   duration at least equal to the configured threshold. Time passing without
   additional measurements cannot extend its duration or create a flatline.
6. A long gap breaks the run. At tolerance 0, any numeric change breaks it.
   With positive tolerance, a reading taking the run's range over tolerance
   breaks it. A new run starts at that reading; only the latest run is evaluated.
7. A previously detected flatline remains last-observed evidence during silence,
   with its last-reading time and frozen observed duration. Resumption after a
   long gap starts a new run. A newer changed reading clears the older warning.
8. Use measuredAt rather than receivedAt or Device.lastSeenAt. Filter out readings
   after the review's checkedAt. Recompute from measurement order when late
   readings or policy changes affect a series; retries do not extend a run.
9. Maintenance pauses affect one device/metric, never the whole estate's metric.
   Owners/assigned managers choose a finite duration, readings remain stored,
   other sensors continue normally, and Council can see the pause status.
10. Pause expiry is enforced by server time even with no browser open. Start
    fresh from the first measurement at/after expiry. Pre-expiry readings remain
    excluded even if they arrive late; retain the cutoff after expiration.
    No fresh readings means no fresh run, not a healthy verdict.
11. Owners and assigned managers/admins view and change settings and pauses.
    Council assigned to that estate views results/settings only. Resident, Crew
    and unassigned users cannot access this feature.
12. An estate Sensors screen shows results, configuration and maintenance
    controls/status. Refresh results every 60 seconds while visible and after a
    successful change. Display checkedAt; use explicit loading/error/retry and
    unconfigured/no-data/no-flatline states.
13. A sensor flag does not record an asset FAULTY assessment, change forecasts,
    create work orders or send notifications.

### Agreed product limits and decimal representation

| Item | Limit | Reason |
| --- | --- | --- |
| Threshold | 1–43,200 minutes (30 days) | Permits short checks and slowly changing metrics, with bounded configuration |
| Maintenance pause | 1–10,080 minutes (7 days) | Finite maintenance window that cannot silently become indefinite |
| Gap cutoff | Strictly greater than 2 × Device.reportingIntervalSeconds | User accepted; ID-68 continuity only, separate from ID-67 warnings |
| Tolerance | 0–999999999999.999999, at most 6 decimal places | Matches stored decimal capacity; not a statement of physically valid sensor ranges |

These are configuration bounds, not measured sensor defaults. Do not build an
indefinite pause, automatic tolerance learning or arbitrary hidden limits.
Equal-to-limit duration/tolerance/gap values are accepted. Validate conversion
and overflow on the server as well as the UI.

### Authorization mapping

Reuse current estate membership storage and authenticated identity. Add narrowly
scoped sensor checks; do not broaden existing asset permissions or redesign roles.

| Current evidence | Read sensors/settings | Edit policy/create pause |
| --- | --- | --- |
| Estate owner, without conflicting same-estate RESIDENT membership | Yes | Yes |
| JWT admin authority plus same-estate MEMBER or COUNCIL management assignment | Yes | Yes |
| Same-estate COUNCIL without admin authority | Yes | No |
| MEMBER without admin authority | No | No |
| RESIDENT in that estate, including conflicting ownership/admin authority | No | No |
| CREW, unknown role, no assignment, or admin assigned elsewhere | No | No |

An admin who is also Council has manager authority only within an assigned
estate. Residency elsewhere does not remove legitimate access here. Verify
current database membership on every request, rather than trusting cached UI
capabilities or a user-provided estate/device ID.

The merged AccessService treats MEMBER/COUNCIL as management readers but
keeps asset mutations owner-only. Its canManageEstate/canViewAssets fields
therefore cannot stand in for the sensor-specific mapping. Existing platform
admin status alone does not authorize an estate. Derive sensor canManage on
the server and return it in this feature's responses.

## Data

Prisma remains the schema owner; Spring uses regenerated jOOQ sources. Add two
models through an additive migration. Leave DeviceReading and its rows intact.

### FlatlinePolicy

| Field | Type/rule |
| --- | --- |
| estateId | UUID; Estate foreign key |
| metric | Existing DeviceMetric code, varchar(30) |
| durationMinutes | Integer, required; proposed 1–43,200 |
| tolerance | Decimal(18,6), non-negative, default 0 |
| createdAt, updatedAt | UTC timestamptz(6) |

Composite primary key: (estateId, metric). No row means Not configured.
Changing a policy reevaluates accepted history on the next review. Last
successful save wins; concurrent policy versioning is outside this story.

### DeviceFlatlinePause

| Field | Type/rule |
| --- | --- |
| deviceId | UUID |
| metric | Existing DeviceMetric code, varchar(30) |
| estateId, assetId | UUID; retain device/asset attribution at pause creation |
| pausedAt, resumesAt | Server-calculated UTC timestamptz(6) |
| pausedByUserId | Authenticated subject, varchar(255) |

Composite primary key: (deviceId, metric). Composite foreign keys
(deviceId, estateId) and (assetId, estateId) preserve estate boundaries, using
the existing unique keys. Add an estateId index for review lookup. Add reverse
relations to Device/Asset as required by Prisma.

Keep the latest pause row after expiry: resumesAt is the fresh-start cutoff.
An expired pause may be replaced by a new pause. A still-active pause cannot
be overwritten or silently extended; return 409. No early resume, extension
or pause-history UI is included in this initial proposal.

Policies/pauses are separate from measurements and asset conditions. If a future
feature moves devices, evaluate only readings and pause attribution matching
the current estate/asset; do not carry history from the previous asset forward.

### Review calculation

- Read active devices/asset combinations inside the authorized estate and
  their registered metrics, using shared policies and latest pause cutoffs.
- Build one response using one injected UTC Clock instant as checkedAt.
  Pause is active precisely while checkedAt < resumesAt.
- Derive detection evidence on read using FlatlineDetector; do not persist a
  second flag state or add an ingestion hook/scheduler to ID-43.
- Keep decimal arithmetic and deterministic ordering. Do not infer a fresh
  sample from lastSeenAt, which identical retries also update.
- Queries remain estate/device/metric scoped. Do not send raw histories to
  the browser, silently truncate history, or substitute zero for load failures.
- Paginate monitoring entries. Before implementation review the reading-query
  plan against the existing (deviceId, metric, measuredAt) index; avoid one
  query per reading. Do not introduce caches or incremental state speculatively.

## API

These public contracts are implemented as Java record DTOs and springdoc
annotations. The exported OpenAPI and generated frontend types remain authoritative.

| Method | Path | Request | Response | Access |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/flatline-policies | None | 200 FlatlinePoliciesResponse | Owner/assigned manager/Council |
| PUT | /estates/{estateId}/flatline-policies/{metric} | SetFlatlinePolicyRequest | 200 FlatlinePolicyResponse | Owner/assigned manager |
| GET | /estates/{estateId}/flatlined-sensors | view, page, size query | 200 FlatlineReviewResponse | Owner/assigned manager/Council |
| POST | /estates/{estateId}/devices/{deviceId}/flatline-pauses/{metric} | CreateFlatlinePauseRequest | 201 FlatlinePauseResponse | Owner/assigned manager |

Path UUIDs and metric codes are required. Units come from DeviceMetric, never
from user-editable policy fields.

### DTOs

- SetFlatlinePolicyRequest: durationMinutes (integer, required, proposed
  1–43,200); tolerance (decimal number, required, non-negative, maximum 6 places,
  maximum 999999999999.999999).
- FlatlinePolicyResponse: metric (DeviceMetric), unit (string),
  durationMinutes (integer or null), tolerance (decimal number, 0 if unconfigured).
- FlatlinePoliciesResponse: canManage (boolean), estateActive (boolean),
  policies (FlatlinePolicyResponse[]). Include every catalogue metric in
  catalogue order, including unconfigured ones.
- CreateFlatlinePauseRequest: durationMinutes (integer, required, proposed
  1–10,080). IDs, actor and start/end timestamps are not accepted in the body.
- FlatlinePauseResponse: deviceId (UUID), metric (DeviceMetric),
  pausedAt/resumesAt (date-time UTC), pausedByUserId (string).
- FlatlineReviewResponse: checkedAt (date-time UTC), canManage (boolean),
  estateActive (boolean), hasSensorReadings (boolean), page/size (integer),
  totalElements (int64), sensors (SensorMonitoringResponse[]).
- SensorMonitoringResponse: deviceId/assetId (UUID), deviceIdentifier/assetName/
  assetReference (string), assetLocationPath/deviceLocationPath (string),
  metric (DeviceMetric), unit (string),
  state (NOT_CONFIGURED | NO_DATA | WAITING_FOR_READINGS | MONITORING |
  FLATLINED | PAUSED), lastReadingAt (date-time or null), lastValue (decimal or
  null), thresholdMinutes (integer or null), tolerance (decimal number),
  flatline (FlatlineEvidenceResponse or null), pause (FlatlinePauseResponse or null).
- FlatlineEvidenceResponse: unchangedSince/lastReadingAt (date-time UTC),
  observedDurationSeconds (int64), minimumValue/maximumValue/latestValue
  (decimal numbers).

All fields above are present; nullable fields are explicitly nullable. Do not
round decimal values again when classifying them.

### Review filters and state

- view: REVIEW (default: FLATLINED or PAUSED) or ALL (inventory for maintenance).
  page defaults to 0; size defaults to 25, range 1–100. Validate non-negative
  page and overflow; order by device identifier, metric catalogue order, then ID.
  Filter before pagination; totalElements refers to the filtered monitoring entries.
- NO_DATA means no eligible sensor measurements have ever been stored for that
  device/metric in its current asset scope. WAITING_FOR_READINGS means data
  exists but no measurement qualifies after the latest maintenance cutoff or
  before checkedAt. Not enough evidence never implies a healthy sensor.
- State priority: active PAUSED, then NOT_CONFIGURED, then NO_DATA/
  WAITING_FOR_READINGS, then FLATLINED or MONITORING.
- A paused entry exposes its pause and last available measurement, but flatline
  is null while paused. After expiry, use the fresh-start cutoff and retain pause
  metadata so readers can understand resumption. Do not display it as active.
- Inactive estates return estateActive false and no monitoring entries;
  their settings remain readable. Retired assets are excluded from monitoring.
- hasSensorReadings means any accepted stored reading exists in this estate's
  current active device/asset scope, independent of the current view/page.

Example policy request:

    {"durationMinutes":120,"tolerance":0.01}

Example pause request:

    {"durationMinutes":60}

Example paused inventory entry (abbreviated):

    {"deviceIdentifier":"PUMP-SENSOR-01","metric":"PRESSURE","state":"PAUSED",
     "flatline":null,"pause":{"resumesAt":"2026-10-20T06:00:00Z"}}

### Errors and concurrency

- 400: malformed UUID/metric, invalid paging/duration/tolerance/JSON.
- 401: missing user identity. Device API keys cannot call these manager APIs.
- 403: known estate membership without the required reader/editor authority;
  Council edit/pause attempts are rejected even via direct API calls.
- 404: nonexistent or unrelated estate/device; do not reveal another estate's
  device identity. Same-estate RESIDENT/owner conflicts follow the merged
  resident-denial convention (403).
- 409: settings/pause writes on an inactive estate, pause on a retired asset,
  metric not registered for the device, policy not configured, or pause already
  active. A location deactivation alone does not block monitoring/pause.
- 503: review/database unavailable; generic message, never partial fabricated
  success. Error body uses EstateError: message (string).
- Lock estate then target asset for writes, following existing lifecycle write
  conventions; serialize duplicate pause creation on its device/metric row or
  unique-key upsert. One overlapping pause succeeds; another receives 409.
  No row locks for read-only reviews. Recheck authorization during the write.
- Responses containing private sensor evidence use Cache-Control: private,
  no-store. Spring Security adds exact method/path matchers; unknown nested
  actions and unsupported methods retain the merged deny-by-default policy.

## Frontend

- Route: /estates/$estateId/sensors, under the signed-in folder route
  apps/web/src/routes/_auth/estates/$estateId/sensors/index.tsx; route-local
  components live beside it in -components.
- Link Sensors from estate details for allowed readers. Use the existing access
  projection plus authenticated admin authority to derive entry visibility;
  authoritative feature responses decide canManage. Do not change global
  canManageEstate/canViewAssets semantics to make this screen work.
- PageHeader uses estate name/breadcrumbs. Use shadcn Table/Card, Field/Input,
  Select, Button, Dialog, Badge, Alert and Empty; reuse existing components.
- Show the default Review list (possible flatlines and maintenance pauses) and
  an All sensors view with pagination so managers can pause a device before it
  is flagged. Clearly label latest measurement, unchanged duration, range/
  tolerance and last checked time. A pause shows its automatic resume time.
- Per-metric settings show numeric duration plus Minutes/Hours selector and
  tolerance with units. First configuration requires a duration; initial tolerance
  is 0. Disabled estate-wide controls and per-device threshold overrides are absent.
- Owners/managers can save policies and open a Pause monitoring dialog for an
  individual device/metric. Require a finite duration; explain its scope, expiry
  and fresh-start behaviour. Do not allow editing an already-active pause.
- Council sees the same evidence and read-only settings/status; no mutation
  controls. Inactive estate shows an explanation and no editing controls.
- Preserve inputs on failure and block duplicate submission/dismissal while
  saving. No-success responses must not clear entered values or show a success
  toast. Hide asset-detail links if those existing endpoints deny the caller.

### Queries and updates

Hooks live in apps/web/src/lib/flatlined-sensors.ts and use the generated client,
existing authenticated session gate and error helpers. Private data is not
fetched during SSR. Use request cancellation signals and throw API errors.

Query keys start with user ID, per AGENTS.md:
- [userId, "flatline", estateId, "policies"]
- [userId, "flatline", estateId, "review", view, page, size]

Policies are fetched when the screen mounts and after saves. Review polls every
60 seconds while visible and refetches on window focus. Both successful policy
saves and pause creation invalidate the estate's policies/review prefix. Errors
have retry controls; loading/failure never substitute zero counts. Each view/page
has its own cache entry. Tests verify account changes do not reuse another
user's data.

## Edge cases

- Threshold, tolerance, gap and expiry equality boundaries are explicit.
- A single reading, duplicates, manual readings or silence cannot create a run.
- Tiny drift beyond the whole-run tolerance cannot remain one unchanged run.
- Late arrivals can invalidate a run. Future measurements become eligible only
  at their measurement time. Receipt-time heartbeats cannot prove continuity.
- Retain a pause cutoff after expiration and server restart; exclude late
  pre-expiry readings. Test no fresh readings and one fresh reading separately.
- A pause for pressure on one device leaves its temperature and another device's
  pressure unaffected. Policy changes do not delete or shorten active pauses.
- Concurrent first pauses, repeated requests and policy saves are deterministic.
- Estate/asset lifecycle changes and permission revocation apply on subsequent
  requests; frontend visibility is never the sole permission check.
- Empty review, unconfigured policies, no data, paused rows and failures have
  distinct text. Filter/page changes cannot overwrite another query's results.
- Support keyboard navigation, labelled inputs, visible focus and narrow-screen
  layouts. Paused/flagged status is not conveyed by colour alone.

## Out of scope

ML inference/training; reading ingestion, manual entry, raw-history browser,
CSV/export, work orders, offline-device notifications, ownership transfer,
a custom role system, per-device threshold/tolerance overrides, automatic
tolerance learning, early pause cancellation/extension and a pause audit UI.

ID-67's future range/quality flags are separate. Initially use all accepted
DeviceReading values rather than depending on an unavailable quality-flag
schema or discarding suspicious measurements.

## Implementation phases and TDD

1. Product decisions were agreed in the review ending 2026-10-20. Verify the
   technical prerequisites and implement the reviewed integration contract.
   Record architectural choices in a new decision note without modifying
   accepted historical decisions; keep the full-story status incomplete until
   integration, generation, tests and documentation are actually verified.
2. Backend contract tests first: unauthorized/foreign access, Council read-only,
   assigned-manager access, malformed policy/pause values and unknown security
   routes. Run and observe the expected failures before implementation.
3. Prisma/repository integration tests first: persist/reload policies and pause
   expiry, unique-pause concurrency, estate constraints and migration replay.
   Create an additive migration on a confirmed isolated development database;
   run pnpm db:migrate and pnpm db:generate. Never hand-edit jOOQ output.
   Do not point unfinished migrations at shared or production databases.
4. Wire readings and detector: use a fixed UTC Clock in tests; demonstrate
   repeat values -> flag -> changed value clears, gap restart, policy changes,
   independent devices/metrics, automatic pause expiry and fresh-start cutoff.
   Reuse the existing detector tests; refactor it only from new failing tests.
5. Generate the real HTTP contract with pnpm api:generate. The app needs a
   migrated reachable database and the existing Infisical setup. Confirm the
   generated files agree with Java; do not fabricate the OpenAPI export.
6. Frontend tests first: manager/Council visibility, policies/form units and
   limits, review/inventory paging, API failures with retained input, refresh,
   pause expiry display and account isolation. Implement shadcn screen/hooks.
7. Extend the existing simulator with a small constant-value/recovery scenario
   and demonstrate the complete flow. Use historical timestamped readings for
   threshold boundaries; use a fixed clock for pause expiry tests, not real sleeps.
8. Run pnpm fix, pnpm check-types and pnpm test through Nx with installed tools.
   Do not install packages or fetch Maven artifacts. Database tests need Docker.
   Document real failures instead of claiming success or weakening tests.
9. Update .docs/api/flatlined-sensors.md, add .docs/frontend/flatlined-sensors.md,
   index both, and update touched estate/access docs to describe only built
   behaviour. Leave all changes uncommitted for human review.

## Implementation prerequisites

No further product question remains from this review. Threshold/edit permissions,
the twice-reporting-interval continuity rule and the seven-day pause maximum are
agreed. This records the human agreement required by AGENTS.md rule 12, which
preceded the integration implementation.

Implementation used disposable Docker Postgres with installed Prisma/jOOQ tools.
A scoped history EXPLAIN uses DeviceReading_deviceId_metric_measuredAt_key for
the device/metric/time predicates and ordering. Batched estate replay has no
arbitrary truncation; its cost grows with retained history (decision 0030).
No connected-account messages, deployment, branch merges or commits are included.

### Verification and environment notes (2026-10-20)

- Detector and API tests were observed failing before implementation. The
  concurrency test was also checked with its active-pause guard temporarily
  removed: both requests succeeded and the test failed; the guard was restored.
  The nullable-object OpenAPI test exposed the springdoc reference/null issue
  before its customizer fix. Frontend tests first failed for the missing screen
  and estate entry; simulator tests first failed for missing scenarios.
- Backend tests cover device-key ingestion -> flatline -> changed-reading
  recovery, roles, policy validation/updates, measurement order/gaps, persisted
  pause cutoffs/expiry, independent devices/metrics and pagination. The suite
  includes 29 detector tests, 42 API integration cases and one concurrency case.
  Web feature tests cover permissions, minutes/hours, failed writes, inventory
  paging, polling visibility and account cache isolation.
- The initial baseline exposed a merged test referencing removed MlClient;
  only its mocked type/import changed to AnomalyScorer. Existing bulk-floor tests
  exposed a missing explicit POST security matcher, which was restored. No
  existing assertions were weakened.
- pnpm api:generate was attempted, but its declared springdoc Maven export plugin
  was absent from the offline cache. No Maven artifacts were fetched. The actual
  API was booted against disposable Postgres; /v3/api-docs was exported and
  openapi-typescript generated the frontend contract. The regular export task
  needs that plugin restored by a human before it can run offline.
- Verification completed: direct server suite 582/582, web suite 315/315 and
  simulator tests 3/3 passed. pnpm check-types and pnpm fix passed. Vite's real
  production build passed and generated the Sensors route tree. git diff --check
  passed. The final web fixture typing change was checked again with the 12
  sensor-screen tests and workspace type checks.
- pnpm test did not complete green: the batched run lost one disposable database
  connection for the existing anomaly suite. That 35-test suite passed separately,
  followed by the full 582-test direct Maven run. The non-batched Nx retry stopped
  at server:validate because the unversioned dev.nx.maven:nx-maven-plugin could
  not resolve from the offline cache. No build-plugin dependencies were installed
  and no existing tests were skipped. This tooling limit remains visible rather
  than being hidden by a green subset or changes to the unrelated Nx configuration.

### Neon child-branch follow-up (2026-10-20)

- After the user created a child branch and updated Infisical, freshly exported
  dev connections were checked: Prisma and the API target the same database,
  and the browser API URL is localhost:8080.
- The configured Prisma URL was pooled. A command-local direct endpoint for
  that same Neon branch was used for migration; no Infisical setting was edited.
- pnpm db:deploy successfully applied six pending migrations, including resident
  reporting/membership/title, device readings and ID-68 policies/pauses. Prisma
  subsequently reported all 16 repository migrations applied.
- Three existing API scenarios also passed against that actual Neon database:
  catalogue settings, device-key ingestion -> flatline -> changed-value recovery,
  and maintenance pause/automatic expiry/fresh-start evidence. Test data was
  transactional and rolled back. The temporary test copy and compiled artifacts
  were removed; no permanent test configuration or credentials were added.
- Manual browser acceptance remains: restart local dev processes to reload
  Infisical and open Estate -> Sensors with the intended user roles.

### Acceptance and responsive UI follow-up (2026-10-20)

- Owner browser checks confirmed constant-reading detection, changed-value
  recovery, tolerance changes re-evaluating history, maintenance pause/expiry,
  fresh readings restarting detection, a 136-second gap resetting a 60-second
  reporting interval's run, and rejection of invalid policy inputs.
- The user then requested compact metric summaries with expandable settings and
  better mobile presentation. This UI revision preserves detection/API/storage
  behaviour. It adds one editor with Cancel/Save, a configured count, responsive
  policy rows and a mobile sensor list retaining evidence and maintenance actions.
- New interactions were observed failing before implementation: missing summary
  actions/mobile list, editor focus, and losing a draft on review-refresh failure.
  Tests cover single-editor selection, cancellation, save summary refresh,
  pending-close protection, responsive draft retention, mobile evidence/actions,
  read-only Council summaries and retry with retained input.
- Updated verification: 20 sensor-screen tests and the full 323-test web suite
  passed; pnpm check-types, pnpm fix and the Nx web production build passed.
  Existing backend/database verification above remains applicable; this revision
  changes only frontend presentation/tests and feature documentation.
- Manual checks remaining: the new layout at phone/tablet/desktop sizes and
  keyboard/zoom in the real browser, followed by manager/Council/resident/foreign
  estate sessions, remaining scope/lifecycle checks and error/retry acceptance.
- Placement refinement: the user requested each editor immediately beneath its
  selected metric rather than after all summaries. Mobile renders it inside that
  list entry; desktop inserts a full-width row before the next metric. Draft and
  mutation state live above the responsive branches, retaining inputs and pending
  saves when the form moves between presentations. Two new placement tests were
  observed failing first. The final sensor-screen suite passed 22/22 and the full
  web suite passed 325/325; pnpm fix, pnpm check-types and the Nx production web
  build passed again. Real-browser placement review remains.
- Terminology/location follow-up: the user selected Monitoring Device, All device
  metrics, Monitoring rules and Pause for maintenance. Navigation, screen copy,
  editor names and feedback now use device/metric wording. Review rows show the
  current asset/device location paths: one shared path, or two labelled paths when
  assignments differ, on desktop and mobile. Paths are batched in the authorized
  estate's repeatable-read snapshot, including inactive ancestors.
- The added HTTP test first failed for absent location fields after correcting its
  fixture to use the app's COMMON_AREA type. Frontend label/location tests also
  failed before implementation. API coverage verifies Council/manager reads,
  distinct assignments, renames, inactive locations and same-location paths; web
  tests distinguish identical asset names under different locations.
- The Spring export plugin remains absent from the offline Maven cache. The real
  springdoc response was exported through a temporary migrated Testcontainers web
  context, excluding its test-only credential probe endpoint. The export source,
  compiled class and reports were removed. Installed openapi-typescript generated
  the contract; the only production schema additions are two required path strings.
- Updated full regression results: server 583/583 and web 327/327, with no failures
  or skipped tests. pnpm fix, pnpm check-types and the Nx web build passed. Existing
  Nx Maven aggregation limitations remain documented above. Manual review of the
  new names/location presentation and the outstanding role/lifecycle checks remain.
- Collapsible policy refinement: the page/navigation now say Device monitoring;
  Metric policies starts collapsed with a settings icon, description, configured
  count and chevron in its accessible header button. Expanded contents remain
  mounted to preserve drafts; collapsing is disabled during saves. Inline editors
  retain their position under the selected metric. New collapsed/mobile/draft tests
  were observed failing first, then passed. Final frontend verification passed
  35 focused cases and all 330 web tests, plus pnpm fix, pnpm check-types and the
  Nx web production build. This refinement changes no backend or database code;
  prior server verification remains applicable. Real-browser visual review remains.
- Combined Nx test recovery: the user's later pnpm test used stale compiled
  Java output, missing both location-path fields; that run also failed to connect
  to one disposable resident-report database. javap confirmed the source/class
  mismatch. The documented Nx server clean and full nx reset removed generated
  output/cache/metadata. The subsequent standard combined test task, with offline
  Maven, cache bypass and static logs, exited 0: all 583 Java and 330 web tests
  passed in 1 minute 49 seconds. No application code or database data changed.
  This supersedes the earlier unverified combined-test status for this fresh run;
  the separate uncached API-export Maven plugin limitation remains documented.
