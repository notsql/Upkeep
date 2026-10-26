# 0039 — One work-order form for inspection follow-up

**Date:** 2026-10-26

## Context

Failed-inspection follow-up had a separate creation form. Sharing only its
basic controls still duplicated the form state, submission and page. The user
requested the existing work-order form, prefilled from a saved inspection, with
cancellation and a later entry point from inspection history.

## Decision

All creation paths render `WorkOrderForm` and use `useWorkOrderForm` for values,
category/priority rules, duplicate-submit protection, POST and navigation.
`useWorkOrderInspection` supplies only saved-source/current-asset reads and
explicit location review; `work-order-inspection-context.tsx` renders its
context and unavailable/already-linked states. There is no separate inspection
work-order form. Source, asset and location remain fixed to the saved inspection
and current asset context; editable work details prefill once.

Cancel returns to the asset history without a write. An unlinked Fail retains a
Create work order action to reopen the same form. Already-linked failures show
their work-order reference, and Pass cannot create linked work. Existing server
authorization, uniqueness and location-conflict validation remain authoritative.

## Consequences

Manual, report and saved-inspection creation share one form and submit handler.
Inspection creation avoids querying editable locations/asset options, retains
explicit move confirmation and never discards a saved inspection on cancel.
No API, generated contract or database change is required.
