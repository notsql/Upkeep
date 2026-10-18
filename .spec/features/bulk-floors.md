# Bulk floors

**Status:** built
**Owner:** ID-99

## Problem

Setting up a block means adding every level one at a time. A 25-storey block
with two basements is 27 dialogs, each needing a name and a position typed by
hand, with nothing stopping inconsistent names.

## Behaviour

- An estate owner can add a range of floors to an active block in an active estate in one action, from a lowest to a highest floor.
- Floors are numbered without a zero: `B2, B1, L1, L2, …`. A floor's position is its number, with basements negative: B2 = -2, B1 = -1, L1 = 1.
- Each new level is named from its floor: `L<n>` above ground and `B<n>` below.
- One request adds at most 50 floors. A range with a zero end, a reversed range, or more than 50 floors is rejected with 400 and a reason.
- A floor the block already has is skipped, not duplicated. "Already has" means an active level in the block with the same position, or the same name (case-insensitive), matching the existing uniqueness rules.
- The response lists the levels created and the names skipped. If every floor exists, nothing is created and that is not an error.
- The levels from one request are created in one transaction: all of them or none.
- A block's actions menu has one "Add levels" item. Its dialog opens on a "Range of floors" tab and offers "One custom level" as the alternative, for levels with their own name and position, such as "Roof" or "Mezzanine". This replaces the separate "Add level" item from ID-53.
- The range tab previews every floor name, highest first, and marks the ones that will be skipped, before anything is saved.
- An unknown block, or an estate the caller does not own, returns 404. A location that is not a block returns 400. A deactivated block or an inactive estate returns 409.
- The location tree and location pickers list a block's levels highest first (… L2, L1, B1, B2 …), the way a building is read. This changes the order from ID-53, which listed them lowest first. The API's order is unchanged.

## Data

No schema change. Floors are ordinary `Location` rows of type `LEVEL`, as in
decision 0014.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | /estates/{estateId}/locations/{blockId}/floors | AddFloorsRequest (`lowestFloor`, `highestFloor`, non-zero integers) | 200 AddFloorsResponse (`created`: LocationResponse[], `skipped`: string[]) | Owner |

## Edge cases

- A deactivated `L5` does not block a new `L5`: uniqueness only counts active levels, so the archived one stays attached to past records. This is agreed with ID-59's archive work: if archiving changes what "active" means, this follows.
- An existing level named something else (for example "Ground") at position 1 makes `L1` a skip, because the position is taken.
- An existing level named `L3` at another position also makes `L3` a skip, because the name is taken.
- Two owners adding floors to the same estate at once are serialised by the estate row lock that every location write takes (decision 0010).
- The "One custom level" tab can still create position 0. Bulk floors never do.

## Out of scope

- Adding common areas in bulk.
- Renaming or renumbering existing levels.
- Floors that skip numbers (for example no L13 or L4). Remove them afterwards with deactivation.
