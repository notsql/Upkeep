# On-screen wording

The glossary and style rules every visible string follows (spec
`.spec/features/plain-english-wording.md`). The code, API, database, URLs and
CSV formats keep their own terms; only the screen changes.

## Style

1. Everyday words from the glossary below. Never show score, threshold,
   metric, timestamp, credential, payload, invalid, mapping, audit, entity, ID
   or raw enum values.
2. Short sentences, one idea each, about 20 words at most.
3. Talk to the reader: "you" and "we", active voice.
4. Errors: "Couldn't <do the thing>. <What to try>." Never "Unable to" or
   "Error:".
5. Success names what changed ("Sensor removed.").
6. Buttons are a verb plus a thing; the dialog title and its confirm button
   use the same verb.
7. Empty states say why it's empty and what to do.
8. Plain numbers: units, readable dates, percentages or words, never raw
   scores.
9. Sentence case.
10. One visible line of hint text (`FieldDescription` or a muted paragraph)
    where a reason is needed. No "?" icons or tooltips for explanations.
11. Warnings: a title (the likely problem), one line of evidence, and a next
    step that is a button the reader can use or a plain instruction.

## Glossary

| Code term | On screen |
| --- | --- |
| anomaly / anomalous | unusual reading ("Unusual readings only") |
| anomaly score, threshold | not shown; charts say "Shaded areas are unusual readings." |
| flatline | sensor may not be working |
| flatline policy | when to warn ("Warn after", "Allowed change") |
| suspect reading | possibly wrong reading ("Possibly wrong only") |
| out of range | outside normal range |
| pause (flatline) | pause warnings |
| metric | measurement |
| device | sensor |
| credential, API key | connection key |
| register / deactivate device | add / turn off sensor |
| reporting interval | how often it reports |
| acknowledge (alert) | mark as seen ("Not seen yet") |
| duplicate (import row) | already imported |
| invalid (import row) | has problems |
| source label (CSV import) | name for this import |
| timestamp | time |
| predicted repair | expected repair |

## Warnings built so far

| Warning | Where | Title · reason · next step |
| --- | --- | --- |
| Sensor may not be working | `SensorLine` (All sensors) | Badge "Sensor may not be working" · "It has sent the same reading (<value>) for <duration>." · **Replace sensor** (owner) / **Pause warnings** (can manage), else "Ask <who> to replace this sensor." |
| Sensor isn't sending readings yet | `DeviceItem` (asset Sensors tab) | note "Sensor isn't sending readings yet" · "Added <relative>, nothing received." · "Make sure it's switched on and set up with its connection key." (the **Get connection key** menu item is beside it) |
| Some readings may be wrong | `PossiblyWrongNote` above the estate reading table | title · "Readings marked outside normal range, sent twice or with a gap may not be accurate." · "Look at the sensor, or take a manual reading to compare." (no review action exists) |
| <Equipment> may have a problem | inbox row (`notification-item.tsx`) and the asset's "Unusual readings" section | title · "Its readings have been unusual since <time>." / "Unusual from … to …" · `UNUSUAL_READINGS_STEP` with **Mark as seen** and **Dismiss** |
| Send crew / Send a contractor | `DispatchAction`, `NotificationDispatch` | see [equipment-dispatch.md](equipment-dispatch.md); non-senders get "Ask <who> to send crew." / "…send a contractor." |

## Who can help

- `lib/who-can-help.ts`: `useWhoCanHelp(estateId, action)` calls
  `GET /estates/{estateId}/who-can-help` (query key
  `[userId, "estates", estateId, "who-can-help", action]`, no retry), and
  `askSomeone(roles, doing)` builds the sentence: one role "Ask a Facilities
  lead to …", two "Ask a Manager or the estate owner to …", three or more
  "Ask a Manager, a Facilities lead or the estate owner to …"; "an" before a
  vowel; empty "Ask someone who manages this estate to …".
- `components/who-can-help/ask-someone-line.tsx`: `AskSomeoneLine({ estateId,
  action, doing })`, a muted paragraph. Renders nothing while loading; a
  failed lookup falls back to the empty sentence and is never shown as an
  error. Mounted only where the reader lacks the button, so readers who can
  act never call the endpoint.

## Guard test

`apps/web/tests/guard/wording.test.ts` scans every file under `apps/web/src`
with Vite's `parseSync` (`tests/guard/visible-strings.ts`): JSX text, string
and template literals inside JSX children, text props (`aria-label`, `title`,
`description`, `label`, `placeholder` …), `toast.*` arguments and `new …Error`
messages. It fails on anomal*, flatline, suspect, metric, credential,
timestamp, "Unable to" and "score". `ALLOWED` is now empty (every phase has landed); a second test fails when an entry no longer matches, so finished
work removes its entries. Never add an entry for new code.

## Words changed in phases 3-7

| Area | Old | New |
| --- | --- | --- |
| Assets | Retire asset · Retired · Retirement date / reason · Edit retirement information | Take out of use · Out of use · Date taken out of use / Why it's out of use · Edit out-of-use details |
| Assets | Record assessment · Condition assessment · Assessment date · Not assessed yet · source "Anomaly detection" | Record condition check · Condition check · Date checked · Not checked yet · source "Unusual readings" |
| Assets | Failure risk · Forecast · Override / Remove override | Chance of breaking down · Expected repairs · Set a custom interval / Edit custom interval |
| Fault reports | Possible duplicate · Duplicate · Duplicate of · Not a duplicate · Link as duplicate · N duplicates | May already be reported · Already reported · Same problem as · Not the same problem · Mark as same problem · N repeat reports |
| Work orders | Correction reason · Save correction · Before/After correction | Why you're changing it · Save changes · Before/After the change |
| Inspections, notifications | Predicted · Interval-based, not a prediction | Expected · Based on the service schedule |
| Everywhere | "Unable to X. Please try again." | "Couldn't X. Try again." |
| Server messages | Device not found · This device is deactivated… · This equipment is retired · Flatline duration/tolerance … · The assessment date cannot be in the future | Sensor not found · This sensor is turned off… · This equipment is out of use · plain sensor-warning wording · The date can't be in the future |
