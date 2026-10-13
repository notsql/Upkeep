# 0026 - Asset categories and models are shared tables

## Status

Accepted.

## Decision

Asset categories move from the server's `AssetCategory` enum to an
`AssetCategory` table keyed by a stable `code`, with a display `label`. Rows
are seeded by migration only. `Asset.category` keeps its column and values and
becomes a foreign key to it.

Manufacturers and models become a catalogue shared by all estates:
`Manufacturer` (unique name) and `AssetModel` (unique per manufacturer and
category). Names are stored normalised: trimmed, inner whitespace collapsed,
uppercased. The asset create and edit requests still send `manufacturer` and
`model` as text. The server normalises them and finds or creates the rows, so
whoever can save an asset can add to the catalogue. A composite foreign key
makes Postgres reject a model from a different manufacturer or category.

Behaviour stays in code, keyed by category code: the forecast prior, the
lifespan, the anomaly model and the silent-failure set are server-side
constants. The server keeps one constant per code it branches on (such as
`PUMP`), not an enum of every category. A category with no constants gets no
forecast.

An asset event snapshots the asset's catalogue manufacturer and model IDs, and
the forecast compares those IDs to decide which events count (decision 0020).

Rejected:
- **Keeping categories as an enum.** Assets and catalogue models both
  reference a category. An enum would leave Postgres unable to enforce it on
  either, and labels would stay hard-coded in the web app.
- **Free-text manufacturer and model.** "Grundfos" and "GRUNDFOS " would be
  different units, and a typo-level difference would reset a pump's forecast
  history.
- **A separate "add manufacturer" step or admin screen.** It adds a workflow
  nobody needs yet. Creating on save keeps the asset form unchanged in shape.
- **Storing behaviour in the category table.** Priors and model thresholds
  change with code and research, not with data entry, like the metric
  catalogue (decision 0016).

## Consequences

`category` on asset requests and responses is a plain string in the contract,
validated against the table, so an unknown code is a 400 rather than a
deserialisation error. Adding a category is a migration. Every code the server
keys a constant on must have a seeded row, which a server test checks.

Catalogue entries are never renamed, merged or deleted, so a typo creates a
permanent new entry. Changing an asset's category resolves its model under the
new category, which is a different row, so earlier events stop counting
toward the forecast.
