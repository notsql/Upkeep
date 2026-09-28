# Asset location picker

**Status:** draft
**Owner:** Zheng Kai
**Jira:** [ID-54](https://notjira.atlassian.net/browse/ID-54) (epic [ID-6](https://notjira.atlassian.net/browse/ID-6) Estate and Location Registry)

## Problem

A plain `<select>` of every location does not scale to an estate with many
blocks and levels, and a technician cannot find "the lift lobby on level 4"
quickly.

## Behaviour

- The asset create and edit forms ([building-assets](building-assets.md)) choose
  a location with a searchable picker, not a text field or a `<select>`.
- The picker lists the estate's active locations by full path, for example
  "Blk 101 › Level 1 › Lift lobby".
- Typing filters the list, case-insensitively, to locations whose block, level
  or area name matches.
- The picker is keyboard operable: arrow keys move through the options, Enter
  selects and Escape closes.
- Location is required. Submitting without one shows a labelled error, and no
  request is sent.
- In edit mode the asset's current location is pre-selected.

## Data

None. `Asset.locationId` is already required.

## API

None. Create and PATCH already require an active location in the same estate.

## Edge cases

- An estate with no active locations shows an empty state that says to add
  locations first, and the form cannot be submitted.
- Search runs in the browser over `useLocations(estateId)`. This is the same
  trade-off the location hierarchy spec makes.
- The picker matches on the **whole path**, so typing "Blk 101" lists
  everything inside that block. It filters `flattenLocations(...)` on
  `path.join(" ")`. The existing `searchLocations` matches only a node's own
  name, and returns nothing for an empty query. `locations-section.tsx` uses
  it, so leave it unchanged.
- With an empty query, the picker lists every active location in tree order.
- The acceptance criterion "surface existing free-text locations for migration"
  is moot: assets have never had a free-text location, so there is nothing to
  migrate.

## Out of scope

- Creating a location from inside the picker.
- Picking locations across estates.

## Dependencies

- [building-assets](building-assets.md), which provides the asset form.
- [location-hierarchy](location-hierarchy.md), which is merged and provides
  `useLocations`, `flattenLocations` and `LocationNode.path` in
  `apps/web/src/lib/locations.ts`.

## Implementation phases

This feature is web only.

### 1. Web tests (red)
- [ ] `apps/web/tests/components/locations/location-picker.test.tsx`:
  - a combobox with an accessible name
  - typing a block, level or area name narrows the options to matching paths,
    and typing a block name lists its levels and areas
  - arrow keys and Enter select
  - an empty selection shows the required error
  - the no-locations empty state
- [ ] Extend `apps/web/tests/components/assets/asset-form.test.tsx`: the create
  and edit forms use the combobox, and edit pre-selects the current location.
- [ ] Run `pnpm nx test web` and confirm the tests fail.

### 2. Web (green)
- [ ] `apps/web/src/components/locations/location-picker.tsx`: an `<input
  role="combobox">` with `aria-expanded` and `aria-activedescendant`, and a
  `role="listbox"` of options. It is built on `flattenLocations`.
- [ ] `packages/ui` has no `command`, `popover` or `select`, so build the
  picker from `@proj/ui/components/input`. Don't add a shadcn component, which
  would pull in new dependencies (AGENTS.md hard rule 1).
- [ ] Replace the `<select>` in `components/assets/asset-form.tsx`.

### 3. Finish
- [ ] `pnpm fix`, `pnpm check-types`, `pnpm test`.
- [ ] Comment on ID-54 that the migration criterion is moot. Set this spec's
  status to built.

## Verification

- The picker and form tests above.
- Manual check: in an estate with several blocks, find a common area by typing
  part of its level name, then save and edit an asset.
