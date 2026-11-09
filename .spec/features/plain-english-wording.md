# Plain-English wording pass

**Status:** built 2026-11-09 (uncommitted) — phases 0-8 done; open question 1 (asset → equipment) still undecided
**Owner:** Ong Zheng Kai

## Problem

The app is used by estate staff and residents, not engineers, but much of its
on-screen text uses the system's own terms. A sample from `apps/web/src`:

- "Anomalies are score ≥ 0.80." · "Anomaly from 09:00 to 09:15, maximum score 0.93."
- "Possible flatline" · "Suspect only" · "No matching suspect readings"
- "Choose a file, source label and distinct mappings for asset, metric,
  measured time and value." · "Invalid metric" · "Duplicate timestamp"
- "Credential issued 3 Nov 2026" · "Not yet acknowledged"
- "Asset retired. Its record has been preserved."
- "Correct the recorded details and give a reason. The order stays Closed;
  the original completion and every correction remain in its audit."
- Around 86 messages start "Unable to …", and many of them don't say what to
  do next.

People can't act on text they don't understand. They end up asking someone,
guessing, or ignoring warnings (anomaly alerts, possibly wrong readings) that
exist to protect them.

This spec sets **one vocabulary and one writing style** for every screen, then
rewords the app area by area. It follows on from
[navigation-regroup.md](navigation-regroup.md), which already rewords the
screens it moves (Check schedules, People & access).

## Writing style

These rules apply to every visible string: headings, labels, buttons, hints,
empty states, toasts, alerts, dialog text, `aria-label`s and screen-reader-only
text.

1. **Everyday words.** Use the glossary below. Never show a code or
   statistics word on screen: score, threshold, metric, timestamp, credential,
   payload, invalid, mapping, audit, entity, ID, enum values (e.g. "MONTH",
   "NONE").
2. **Short sentences.** One idea per sentence, about 20 words at most.
3. **Talk to the reader.** Active voice, "you" and "we". "We've kept its
   history", not "Its record has been preserved."
4. **Errors say what happened and what to do.** Use the pattern "Couldn't
   <do the thing>. <What to try>." For example: "Couldn't save the report.
   Check your connection and try again." Don't blame the user, and don't
   start with "Unable to" or "Error:".
5. **Success says what changed.** Name the thing: "Report saved.", "Sensor
   removed." Don't write "Operation successful."
6. **Buttons are a verb plus a thing.** "Save report", "Remove sensor". Use the
   same verb in the dialog title and its confirm button.
7. **Empty states say why it's empty and what to do.** "No readings yet. They
   appear here once the sensor sends one."
8. **Numbers are plain.** Show units and readable dates and times. Write
   percentages or words ("high", "low") rather than raw scores.
9. **Sentence case** for headings and buttons.
10. **Explain once, where it's needed.** When a setting or warning needs a
    reason, put **one visible line of hint text** under the heading or field
    (shadcn `FieldDescription`, or a muted paragraph). No "?" icons or hover
    tooltips: they don't work on phones, people miss them, and screen readers
    handle them badly. A hint is plain text, not a paragraph.
11. **Warnings say what it means for you, then what to do.** Don't describe
    what the system detected; say what is likely wrong and how to fix it.
    Every warning has three parts:
    - **Title: the likely problem, in the reader's terms.** "Sensor may not
      be working", not "Possible flatline".
    - **Reason: one line of evidence.** "It has sent the same reading for 3
      hours."
    - **What to do: one or two next steps.** Each is a button or link to an
      action the app already has, or a plain instruction when no action exists
      ("Ask a technician to look at the sensor.").

    A warning with no next step is a bug in the wording. See
    [Warnings](#warnings) for each one.

## Glossary

The left column is the code/API term, which **stays in code, API, database and
URLs**. The right column is the only word shown on screen.

| Code term | On screen | Notes |
| --- | --- | --- |
| anomaly / anomalous | unusual reading | Filter "Unusual readings only"; alert titles follow [Warnings](#warnings) |
| anomaly score, threshold | *(not shown)* | Charts shade unusual stretches; text says "Shaded areas are unusual readings." |
| flatline | sensor may not be working | Never "flatline" or "stuck"; see [Warnings](#warnings) |
| flatline policy (threshold, tolerance) | when to warn about a sensor | "Warn me if a sensor sends the same reading for…" |
| suspect reading | possibly wrong reading | Filter "Possibly wrong only" |
| out of range | outside normal range | "Outside normal range (20 to 30 °C)" |
| pause (flatline) | pause warnings | "Pause warnings while you work on it" |
| metric | measurement | e.g. temperature, pressure |
| reading | reading | Already plain; keep |
| device | sensor | One word for both, everywhere |
| credential | connection key | "Connection key created 3 Nov 2026" |
| register / deactivate device | add / turn off sensor | |
| reporting interval | how often it reports | |
| service interval | how often (to service) | Matches Check schedules |
| silent-failure flag | regular checks on/off | See navigation-regroup |
| acknowledge (alert) | mark as seen | "Not seen yet" |
| dismiss (alert) | dismiss | Already plain; keep |
| duplicate (fault report) | already reported | "May already be reported", "Same problem as #123" |
| urgency | urgency | Keep |
| retire / retirement | take out of use / out of use | "Taken out of use on 3 Nov 2026" |
| condition assessment | condition check | |
| failure risk | chance of breaking down | |
| forecast / predicted repairs | expected costs / expected repairs | |
| audit, correction history | change history | |
| council member | member | |
| source label, mapping (CSV import) | file name, match columns | "Match each column in your file" |
| timestamp | date and time | |
| provenance / source | where it came from | |

Open question 1 decides whether **asset** and **work order** change too.

## Warnings

Every warning the app shows, written to style rule 11. "Action today" lists
only buttons that already exist. This spec adds **no new actions**. Where none
exists, the step is plain text and the gap is listed in open question 4.
Exact wording is confirmed in each phase's wording table.

| Code name | Title (likely problem) | Reason (one line) | What to do | Action today |
| --- | --- | --- | --- | --- |
| Flatline | Sensor may not be working | It has sent the same reading (21.4 °C) for 3 hours. | Replace the sensor. If someone is already working on it, pause warnings until they're done. | **Replace sensor** (existing "Replace device" page, `…/devices/$deviceId/replace`); **Pause warnings** (existing pause dialog) |
| Anomaly alert | <Equipment> may have a problem | Its readings have been unusual since 09:00. | Have someone look at it. Mark as seen once it's being handled. Dismiss it if this was expected, e.g. during maintenance. | **Mark as seen**, **Dismiss** |
| Suspect / out-of-range reading | This reading may be wrong | 85 °C is outside the normal range (20 to 30 °C). | Check the sensor, or take a manual reading to compare. | Existing confirm / reject on the reading, if shown to this user |
| Failure risk high | <Equipment> is likely to break down soon | Based on its age, condition and repair history. | Arrange a check before it fails. | Link to the asset page (no direct "create work order from asset" today) |
| Condition needs a check | <Equipment> needs a condition check | Its last check was 14 months ago. | Record what you see. | **Record condition check** (existing "Record assessment") |
| Service due (notification) | <Equipment> is due for servicing | Due on 3 Dec, based on its every-6-months schedule. | Book a service. | Link to the asset page |
| Inspection check due | <Equipment> is due for a check | (from its check schedule) | Do the check and record the result. | Existing record-result action on Due checks |
| Possible duplicate fault report | This may already be reported | It looks like report #123 (same place, same problem). | If it's the same problem, link them. If not, keep it separate. | **Link them** / **Keep separate** (existing Confirm / Not a duplicate) |
| Sensor awaiting first reading | Sensor isn't sending readings yet | Added 2 hours ago, nothing received. | Make sure it's switched on and set up with its connection key. | **Get connection key** (existing "Generate credential") |

**When the reader can't take the action.** Each action keeps its current
permission check. A reader without that permission does not see the button.
In its place the warning says who to ask, and **the server works that out
from the estate's real roles; the web app never hard-codes a role name.** An
estate with a custom role "Facilities lead" that can do the action gets "Ask
a Facilities lead to replace this sensor." An estate where only the owner
can do it gets "Ask the estate owner to replace this sensor." A warning never
shows a button that would fail. See [Who can help](#who-can-help).

The alert "type" labels in the notification inbox and settings use the same
titles, e.g. a setting "Sensor may not be working" with the hint "Warn
managers when a sensor keeps sending the same reading."

## Behaviour

- Every visible string in `apps/web/src` follows the writing style and uses
  only the right-hand glossary words. A string is in scope if it shows on
  screen or reaches a screen reader.
- Every warning in the [Warnings](#warnings) table shows a title, a reason
  and at least one next step. Where an action exists today and the user is
  allowed to use it, the next step is that button or link. Tests check each
  warning's title and that its action is reachable by role and name.
- "Sensor may not be working" links to that sensor's Replace page for a
  reader who can replace devices. It shows Pause warnings for a reader who can
  pause. A reader who can do neither sees no button, and instead sees "Ask
  <who> to replace this sensor.", where <who> comes from
  [Who can help](#who-can-help).
- A test checks the glossary. It scans visible strings in `apps/web/src`
  (JSX text, string literals and template literals passed to known text props,
  `aria-label`, toasts, `Error` messages shown in UI). It fails on
  any banned word: anomal*, flatline, suspect, metric, credential, timestamp,
  "Unable to", "score". Each allowed exception sits in a short, commented
  allow-list in the test. This keeps new code from bringing the jargon back.
- Server error messages that reach a screen follow the same rules. They live in
  the `@RestControllerAdvice` handlers and the `new …Exception("…")` messages
  in `apps/server`; about 25 literal messages are shown today. API field names,
  enum values and status codes don't change, so the OpenAPI contract stays the
  same apart from `description` text.
- Apart from text and the "who can help" lookup below, nothing else changes:
  same screens, same buttons in the same places, same permissions.

### Who can help

- The server answers "who in this estate can do <action>?" for the
  actions a warning points at: `REPLACE_SENSOR`, `PAUSE_SENSOR_WARNINGS`,
  `GENERATE_CONNECTION_KEY`, `RECORD_CONDITION`, `REVIEW_READING`,
  `ACKNOWLEDGE_ALERT`, `REVIEW_DUPLICATE`. The list grows only when a new
  warning needs it.
- The answer is the **display names of the roles** whose current members
  are allowed to do it. Roles include preset ones (Manager, Crew…), custom
  ones, and "estate owner". Each role appears once, in a fixed order: estate
  owner last.
- **One source of truth.** The server uses the same authorization check that
  guards the action's endpoint. It does not keep a second table of who may do
  what. A parity test proves this: for each action, every member's role is in
  the answer if, and only if, that member's request to the guarded endpoint is
  allowed.
- **Only roles someone actually holds.** A role with no current members is
  left out, so nobody is told to ask a role that's empty. The estate owner
  is always included when the owner can do the action.
- **Live.** If an admin gives a custom role the permission (or takes it away),
  the next lookup reflects it. Nothing is cached beyond the normal React Query
  lifetime, and the key starts with the user's ID.
- The web app turns the list into a sentence: one role → "Ask a Facilities
  lead to…"; two → "Ask a Manager or the estate owner to…"; three or more →
  "Ask a Manager, a Facilities lead or the estate owner to…". It never adds
  a role name of its own.
- If the answer is empty, or the lookup fails, the warning says "Ask
  someone who manages this estate to…". The warning itself still shows, and the
  lookup failure is not shown as an error.
- The lookup runs only when a warning needs it (the reader lacks the
  action). Readers who have the button never call it.

## Data

None. Roles, custom-role permissions and ownership already exist; the lookup
reads them.

## API

One new read-only endpoint (phase 1). Apart from that, only human-readable error
`message` strings and possibly OpenAPI `description` text change. Run
`pnpm api:generate` and commit the result with each change that touches them.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/who-can-help` | query `action` (required, enum `HelpAction`: values above) | 200 `WhoCanHelpResponse { action: HelpAction, roles: string[] }`; 400 unknown action; 404 not a member of the estate | Any current member of the estate (they can already see the warning) |

Role names only, never member names or contact details. This shows readers
the names of roles that can do an action. Today they may only see their own
role, so this is a small new disclosure (see open question 3).

## Edge cases

- **Tests that assert old text.** Many web tests query by accessible name
  ("Unable to …", "Anomalous only"). For each area, first change the test to
  the new text and watch it fail, then change the component. This is a planned
  behaviour change, not editing a test to make code pass.
- **Server messages tested on the web.** Web tests that stub a server error
  message keep whatever text they stub. Only the real server strings change.
- **Same word, two meanings.** "Check" now means an inspection check
  (Check schedules). Avoid using it for "verify"; say "make sure" or "look at"
  instead. "Possibly wrong" readings are not inspection checks.
- **Dynamic text.** Pluralisation (`plural(...)`), template strings and
  formatted numbers must still read naturally ("1 unusual reading", "2
  unusual readings").
- **CSV exports and imports.** Column headers in exported CSVs, and the
  column names the importer expects, are a file format, not screen text. They
  don't change.
- **Device simulator** (`apps/device-simulator`) is a developer tool and out of
  scope.

## Out of scope

- Translation or i18n (no string catalogue, no locale switching). Strings
  stay inline where they are.
- Renaming anything in code, API, database, URLs or CSV formats.
- Layout, visual or flow changes. Adding hints is the only new text, and
  only where rule 10 applies.
- Platform admin screens (`/admin`), used by the team itself. Reword them only
  if they're quick wins inside an area being done anyway.
- Emails and push notifications (there are none outside the in-app inbox).

## Implementation phases

Each phase is one area: inventory → wording table → tests → change. Before
building a phase, add an **old → new wording table** for it to this spec
(as in navigation-regroup.md) and have it agreed. Tests assert the new text.

- [x] **0. Guard test.** The banned-word scan, with every current hit in its
      allow-list. It passes on day one; each later phase removes its entries.
- [x] **0b. Who can help.** `GET /estates/{estateId}/who-can-help` with its
      parity test (server, test-first), `pnpm api:generate`, then
      `useWhoCanHelp` in `apps/web/src/lib/who-can-help.ts` and the
      sentence builder, tested for one, two, three or more roles, empty, and
      error.
- [x] **1. Readings and sensors.** Asset readings and charts, View all
      readings, CSV import/export screens, devices/sensors, flatlined and
      possibly-wrong readings. Most of the jargon is here.
- [x] **2. Alerts and notifications.** Notification inbox, anomaly alerts,
      notification settings.
- [x] **3. Assets.** Asset register, asset page (overview, condition,
      maintenance, retirement, history, documents), failure risk, costs.
- [x] **4. Maintenance.** Fault reports (including duplicates and urgency),
      work orders (including corrections), inspections.
- [x] **5. Estate, people and account.** Overview dashboard, locations,
      estate settings, members, roles, invitations, account, estate
      directory, sign-in.
- [x] **6. Resident screens.** Resident home and fault reporting.
- [x] **7. Server messages.** Every exception message a screen can show, in
      the same style. Server tests that assert the message text change first.
- [x] **8. Docs.** `.docs/frontend/*.md` quote screen text; update each with its
      phase. Add the glossary and style rules to
      `.docs/frontend/formatting.md` (or a new `wording.md`) so future work
      follows them.

## Open questions

1. **"Asset" and "Work order".** Both are standard terms for property
   managers and contractors in Singapore. "Asset" is the less plain of the two:
   residents and new staff would say "equipment". The recommendation is to
   change **asset → equipment** on screen (sidebar "Equipment", "Equipment
   type") and keep **work order**, which staff already use with contractors.
   Agree?
2. **Who checks the wording?** Is there an estate manager or resident who
   could read a phase's wording table before it's built? If not, the review
   is yours alone.
3. ~~Role names vs people.~~ **Decided:** role names only ("Ask a
   Facilities lead to…"). No member names.
4. **Phase order.** The order above starts where the jargon is worst
   (readings and alerts). Is there a demo or deadline that should go first?
5. **Equipment warnings with no button.** Decided direction: staff should not
   self-inspect equipment they can't judge. Due checks, "likely to break
   down soon" and end-of-life warnings will offer **Send crew to inspect** or
   **Send a contractor**. Until that feature is specced and built
   (separate spec, [equipment-dispatch.md](equipment-dispatch.md)), these rows link to the asset
   page with plain text. Their wording tables are written in that spec, not
   here.

## Built so far (2026-11-09)

Wording tables for the phases built. Tests assert the right-hand column.

### 0b. Who can help

Built as specified, with `SEND_CREW` and `SEND_CONTRACTOR` from
equipment-dispatch.md. **Deviation:** `REVIEW_READING` is not in `HelpAction`:
there is no confirm/reject endpoint for readings to derive it from, so the
"possibly wrong reading" warning's step is plain text. Add it with that action.
An inactive estate still returns the roles (every write is refused there
anyway); the parity test probes each guard on a deactivated estate, where a
member who passes the permission check gets 409.

### Navigation-regroup follow-ups

| Old | New |
| --- | --- |
| Categories flagged for spot checks | Equipment types with regular checks |
| N of M categories need an interval | N of M equipment types have no schedule |
| Service interval for <Label> | How often to service <Label> |
| (sr-only) No flagged categories | No regular checks |
| tab title Council members | Members |
| tab title Pending invitations | Waiting to join (matches the tab) |

### 1. Readings and sensors

| Old | New |
| --- | --- |
| All devices (page, tab, table) | All sensors |
| Device / Devices (headings, columns, tab) | Sensor / Sensors; reading column "Sensor name" |
| Possible flatline | Sensor may not be working (+ reason, Replace sensor / Pause warnings / Ask) |
| Pause for maintenance · Pause <id> <metric> · Start pause · Pause duration | Pause warnings · Pause warnings for <id> <measurement> · Pause warnings · Pause for |
| Monitoring / Paused / Not configured / Waiting for fresh readings | Working / Warnings paused / No warning set / Waiting for new readings |
| Metric policies · Estate-wide thresholds and tolerances (for flatline detection) | When to warn · How long a sensor can send the same reading before we warn you |
| Threshold · Tolerance (unit) · Configured · N of M configured · No policy · Save policy | Warn after · Allowed change (unit) · Set · N of M set · No warning set · Save warning |
| Register device · Replace device · Deactivate device | Add sensor · Replace sensor · Turn off sensor |
| Generate credential · Replace credential · Credential issued · No credential · API key | Get connection key · Replace connection key · Connection key created · No connection key · Connection key |
| Device identifier · Device identity · Supported metrics · Expected reporting interval (seconds) | Sensor name · Sensor details · What it measures · How often it reports (seconds) |
| Awaiting first reading · Deactivated | Waiting for first reading (+ "Sensor isn't sending readings yet" note) · Turned off |
| Anomaly · N, max 0.88 · score ≥ 0.60 · Anomaly score 0.88 · N anomalies in range | Unusual readings · N · Shaded areas are unusual readings. · Unusual reading · N unusual stretches |
| Anomaly 0.87 · Duplicate timestamp · Out of range (valid a to b) | Unusual reading · Sent twice for the same time · Outside normal range (a to b) |
| Metric · All metrics · Invalid metric · Suspect only · Anomalous only | Measurement · All measurements · Unknown measurement · Possibly wrong only · Unusual readings only |
| Showing N timestamps | Showing N times |
| Source label · Metric column · Asset UUID · Invalid · Duplicate · raw COMPLETED/REVERTED | Name for this import · Measurement column · Asset system code · Has problems · Already imported · Imported / Undone |
| Unable to … (credential, register, deactivate, CSV, revert, report) | Couldn't …. Try again. |
| (new) | "Some readings may be wrong" note above flagged estate readings |

### 2. Alerts and notifications

| Old | New |
| --- | --- |
| Acknowledge · Not yet acknowledged · Acknowledged by | Mark as seen · Not seen yet · Marked as seen by |
| inbox anomaly row: server summary | "<Equipment> may have a problem" · "Its readings have been unusual since <time>." · next-step line |
| type badges Anomaly · Repair predicted · "Prediction ·" | Unusual readings · Repair expected · "Expected repair ·" |
| Anomaly alerts · Raised when anomaly detection finds abnormal readings · Median score … · First detected … last detected | Unusual readings · Warnings about readings that don't look normal · (removed) · Unusual from … to … |
| Anomaly score threshold (0.51-1.00) | How sure before we warn you (%) (51-100, saved as 0.51-1.00) |
| Service reminder lead time (days) · Repair prediction lead time | Days of notice before a service is due · Notice before an expected repair |

Server-written text (notification `summary`, the anomaly `explanation`) is
phase 7 and still shows as sent.

### 3. Assets

| Old | New |
| --- | --- |
| Retire asset · Retired (badge, filter) · Asset retired. Its record has been preserved. | Take out of use · Out of use · Asset taken out of use. We've kept its history. |
| Retirement date · Retirement reason · Edit retirement information · Retirement corrected · Previous retirement | Date taken out of use · Why it's out of use · Edit out-of-use details · Out-of-use details changed · Previous out-of-use date |
| Record assessment · Condition assessment · Assessment date · Not assessed yet · Assessment recorded. | Record condition check · Condition check · Date checked · Not checked yet · Condition check recorded. |
| Assessment date is required. · The assessment date cannot be in the future. | The date checked is required. · The date can't be in the future. |
| source "Anomaly detection" | Unusual readings |
| Failure risk · Forecast · Loading forecast… | Chance of breaking down · Expected repairs · Loading expected repairs… |
| Override · Edit override · Override service interval · Override last changed by · Override removed. | Set a custom interval · Edit custom interval · Set a custom interval · Custom interval last changed by · Custom interval removed. |

### 4. Maintenance

| Old | New |
| --- | --- |
| Possible duplicate · Duplicate (badge, section) · Possible duplicate of / Duplicate of | May already be reported · Already reported · May be the same problem as / Same problem as |
| Not a duplicate · Link as duplicate · Duplicates · N (confirmed) duplicates · Duplicate reports | Not the same problem · Mark as same problem · Repeat reports · N (confirmed) repeat reports · Repeat reports |
| If this is not a duplicate, reject the link to allow one. | If it's a different problem, choose Not the same problem first. |
| Correction reason · Save correction · Before/After correction · …remain in its audit | Why you're changing it · Save changes · Before/After the change · …in its change history |
| Predicted (inspection basis) · Regenerating adds newly due checks… | Expected · This adds checks that are now due and never adds the same check twice. |
| Interval-based, not a prediction (notification) | Based on the service schedule |
| reading row DUPLICATE_TIMESTAMP "Duplicate" | Same time as another |

### 5-6. Estate, people, account and resident screens

Every "Unable to X. (Please try again.)" became "Couldn't X. Try again."
(keeping any specific next step). Role picker "Council member" → "Council".
No other banned or glossary words were on these screens. The guard's
allow-list is now empty.

### 7. Server messages

| Old | New |
| --- | --- |
| Device not found. | Sensor not found. |
| This device is deactivated. It cannot be given a key. | This sensor is turned off. You can't give it a connection key. |
| This asset is deactivated. Its devices cannot be changed. | This asset is out of use. You can't change its sensors. |
| This estate is inactive. Devices cannot be registered. / Its devices cannot be changed. | This estate is inactive. You can't add sensors. / You can't change its sensors. |
| This equipment is retired. | This equipment is out of use. |
| Flatline duration must be a positive whole number of minutes. · Flatline tolerance must not be negative. | Enter how long to wait, in whole minutes, before warning about a sensor. · The allowed change can't be negative. |
| Sign in to manage devices. · Sign in to monitor device readings. | Sign in to manage sensors. · Sign in to see sensor readings. |
| The anomaly model failed. Try the batch again later. | We couldn't check these readings for anything unusual. Try the import again later. |
| The assessment date cannot be in the future. | The date can't be in the future. |
| Unable to read upload. · Unable to load recorded history. Try again. | Couldn't read the file. Try again. · Couldn't load the history. Try again. |

Not changed: notification `summary` and anomaly `explanation` text written by
the server (stored rows; changing them needs a data decision), and internal
model errors no screen shows.

### 8. Docs

`.docs/frontend/*.md` quotes updated; `.docs/frontend/wording.md` lists the
phase 3-7 changes.
