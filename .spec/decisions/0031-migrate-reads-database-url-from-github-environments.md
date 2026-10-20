# 0031 - Migrate reads `DATABASE_URL` from GitHub environments

**Status:** accepted (amends 0027)

## Context

0027 had `migrate.yml` log in to Infisical with GitHub OIDC as a machine
identity. Machine identities with OIDC auth are not available on Infisical's
free plan, so every Migrate run failed at the login step. The Infisical
project already has a GitHub App Connection.

## Decision

- **Infisical stays the source of truth (0018)** and pushes `DATABASE_URL` into
  GitHub through two **Secret Syncs** over the existing App Connection:
  Infisical `dev` `/packages/db` -> GitHub environment `dev`, and Infisical
  `prd` `/packages/db` -> GitHub environment `prd`.
- `migrate.yml` picks its environment from the branch (`main` -> `prd`,
  anything else -> `dev`) and reads `secrets.DATABASE_URL`. It no longer
  requests an OIDC token or uses `Infisical/secrets-action`.

## Consequences

- The Neon URLs are now stored in GitHub, as environment secrets. Rotating one
  in Infisical reaches GitHub on the next sync.
- A manual run from a feature branch targets the `dev` environment. Restrict
  `prd` to `main` with a deployment branch rule on the environment.
- The `INFISICAL_IDENTITY_ID` and `INFISICAL_PROJECT_SLUG` repository
  variables are no longer needed.
