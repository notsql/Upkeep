# 0038 — Inspection form component boundaries

**Date:** 2026-10-26

## Context

The inspection recording form combines fields, photo previews, conflict
recovery, saving and navigation in one 430-line file. The user approved a
local component split that preserves its behaviour.

## Decision

Keep state and workflow transitions in `InspectionForm`. Extract controlled
fields, photo selection/validation/previews, feedback/recovery and the
saved-record notice into sibling route-local components. Photo previews own
their object URLs and release them on removal and unmount. The parent owns
selected files and the observed/reviewed locations so only explicit confirmation
changes the submitted location. Keep duplicate-save protection, saving and
navigation together so a navigation failure cannot expose another save action.

## Consequences

The form remains readable through explicit props without a form context or
controller hook. UI sections can be understood separately; interaction tests
continue to exercise the complete screen. These components stay local to this
route and use the existing shadcn controls and generated API types.
