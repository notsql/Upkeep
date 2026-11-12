# 0055 - Contractors under Administration

## Status

Accepted.

## Context

The sidebar listed Contractors in the Maintenance group, beside Fault reports,
Inspections and Work orders. We considered folding all maintenance items into
one tabbed Maintenance section and rejected it: it hid pages used by different
audiences behind one heading. Contractors is a directory that is set up
occasionally, not part of day-to-day maintenance work.

## Decision

- Contractors moves to the Administration group, ordered People & access,
  Contractors, Estate settings.
- Maintenance keeps Fault reports, Inspections and Work orders.
- Route, icon and visibility (`canOpenContractors`) are unchanged.

## Consequences

The mobile bar's Maintenance tabs no longer include Contractors; it appears
under Admin instead. No routes or permissions change.
