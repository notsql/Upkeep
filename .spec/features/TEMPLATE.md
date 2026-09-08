# <Feature name>

**Status:** draft | agreed | built
**Owner:** <name>

## Problem

What the user cannot do today, and why that matters. Not the solution.

## Behaviour

The rules, as statements that can be true or false. Write these so a test can
be derived from each one.

- ...

## Data

Which Prisma models this adds or changes. Remember: Prisma owns the schema,
so any new table starts life in `packages/db/prisma/schema/schema.prisma`.

## API

The endpoints this adds, as they will appear in the OpenAPI contract.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| | | | | |

## Edge cases

The cases that are easy to get wrong: empty states, concurrent writes,
permission boundaries, partial failures.

- ...

## Out of scope

What this deliberately does not do, so reviewers don't ask for it.

- ...
