# 0021 — Asset retirement records a business date and append-only lifecycle history

Status: accepted, 2026-10-07. Scope: ID-51 and the missing ID-47 register.

Retain Asset.deactivatedAt as the active/retired discriminator and operation time.
Add retiredOn and retirementReason for the business event; dates may be backdated
but cannot precede known installation or exceed today's Singapore date. Existing
retirements keep null metadata, without fabricated history.

Owners can correct retirement information and restore the same asset. Every
transition atomically increments lifecycleVersion and appends an event carrying
actor, operation time and before/after snapshots. Requests include expectedVersion;
stale requests return 409. Estate-then-asset locking preserves the existing write
order and prevents transitions bypassing estate deactivation. History, devices
and assessments remain attached to the original asset. Replacements get a new
asset/reference; no replacement relation is introduced.

The register derives condition from the latest assessment, rather than storing a
second editable condition. Bulk SQL computes hierarchical location paths and
latest assessment; filters include inactive locations for historical discovery.
API INACTIVE is labelled Retired in the UI. Asset access remains owner-only and
is independent of the unmerged council-invitation feature.
