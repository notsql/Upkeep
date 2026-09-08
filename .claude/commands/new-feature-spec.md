---
description: Draft a feature spec in .spec/features/ before any code is written
argument-hint: <feature name and a sentence about it>
---

Write a feature spec. Do not write implementation code in this task.

Feature: $ARGUMENTS

1. Read `.spec/README.md`, `.spec/architecture.md` and
   `.spec/features/TEMPLATE.md`.
2. Create `.spec/features/<kebab-case-name>.md` from the template, filling in
   every section.
3. Write the **Behaviour** section as statements that are either true or false,
   so each one can become a test.
4. In **Data**, name the Prisma models involved; in **API**, fill the endpoint
   table as those endpoints will appear in the OpenAPI contract.
5. Be concrete about **Edge cases** and honest about **Out of scope** - YAGNI
   applies to specs too.
6. Where the spec depends on an assumption you cannot verify from the repo,
   list it at the end under "Open questions" rather than guessing.

Then stop and let me review before anything gets built.
