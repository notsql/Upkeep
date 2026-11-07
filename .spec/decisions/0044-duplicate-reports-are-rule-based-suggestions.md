# 0044 — Duplicate fault reports are rule-based suggestions a manager confirms

**Status:** accepted for ID-74, 2026-11-05. Spec:
`features/fault-report-duplicates.md`.

On submission, compare a new report against open, unlinked reports in the same
location group: a level and its common areas, or a block's direct common areas.
Score the text in plain Java (token Jaccard similarity plus a fixed list of
repeat cues such as "again"). The best qualifying match is saved as a
`SUSPECTED` link. A manager confirms or rejects it, or links reports by hand.
Links live in their own table, `IssueReportDuplicate`, one row per duplicate.
Originals never hold an active link, so chains cannot form.

Rejected alternatives:

- **Postgres `pg_trgm` or full-text search.** This needs an extension, and the
  "never install" rule and Neon setup make that a human step. The candidate set
  is already small (one location group in one estate), so Java scoring is cheap.
- **An ML or embedding model.** There is no labelled report data to train or
  tune on, and a model is harder to explain to a manager than "same level,
  similar words, said 'again'".
- **Automatic linking above a confidence threshold.** A wrong automatic link
  hides a real, separate fault. Suggest-and-confirm keeps a person in charge.
- **Automatically raising work-order priority from the count.** Managers decide
  priority. There is still no endpoint to change a saved work order's priority;
  that is a separate story.
- **A time window on candidates.** A fault that resurfaces a year later is the
  same fault. Reports with no work order stay open, and collecting candidates,
  indefinitely, and this is intended.
- **Duplicate fields on the shared report DTOs.** Resident endpoints reuse
  `IssueReport*Response`, so the duplicate data lives in estate-only DTOs. That
  keeps it out of every resident response.
- **`expectedState` on manual linking.** Estate responses expose only active
  links, so a client cannot tell "no link" from "rejected link". The 409 for an
  existing active link already covers the race that matters.

**Revised 2026-11-05 after review:** a work order cannot be created from a
report with a `SUSPECTED` or `CONFIRMED` link; the server returns 409 and the
page hides the action. Warning only was rejected because it still let one leak
become several work orders. Blocking suspected links too was preferred over
blocking confirmed links only, even though a wrong suggestion now blocks that
report until a manager rejects it.

The threshold (0.25), the stop words and the cue list are untuned first guesses
held as constants in `DuplicateDetector`. Revisit them once real report text is
available.
