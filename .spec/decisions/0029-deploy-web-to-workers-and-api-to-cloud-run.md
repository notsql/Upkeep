# 0029 - Deploy web to Cloudflare Workers and the API to Cloud Run from `main`

**Status:** accepted (amends 0027)

## Context

The app only ran locally or as a local Docker Compose stack. Nothing was
reachable from the internet and nothing redeployed when a PR merged. There is
no custom domain and the budget is free tiers. Java cannot run on the Workers
runtime. Spec: `features/deployment.md`.

## Decision

- **`apps/web` is a Cloudflare Worker (`web`)** built by
  `@cloudflare/vite-plugin` (`viteEnvironment: { name: "ssr" }`, before
  `tanstackStart()`), configured by `apps/web/wrangler.jsonc` with
  `nodejs_compat`. Nitro and `apps/web/Dockerfile` are removed: production is
  workerd, so one build config. WorkOS server secrets reach the library via
  `process.env`, which `nodejs_compat` populates from Worker secrets on
  compatibility dates >= 2025-04-01.
- **Workers Builds deploys `web` on push to `main`** (watch paths
  `apps/web/**`, `packages/{api,ui,env}/**`). Non-production branch builds are
  off, since a preview shares production's secrets.
- **`apps/server` is a Cloud Run service (`api`, `asia-southeast1`, beside
  Neon `prd`)** running `apps/server/Dockerfile`: 1 vCPU, 2 GiB,
  request-based billing, scale 0-2, startup CPU boost, startup probe on
  `GET /health`. The image unpacks the Spring Boot jar and ships a JDK AOT
  cache from a training run; `deploy.yml` sets
  `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=60` (Cloud Run only).
- **`.github/workflows/deploy.yml` deploys `api` on push to `main`** touching
  `apps/server/**` or `pom.xml`, authenticating with Workload Identity
  Federation restricted to `notsql/CS203` on `refs/heads/main`. Chosen over a
  Cloud Build trigger: it matches the OIDC pattern of `migrate.yml`, lives in
  git and needs no GitHub App. No Cloudflare or GCP credential lives in
  GitHub.
- **A long-lived `dev` branch sits between feature branches and `main`.**
  PRs into either run `pr-checks.yml`. A push to `dev` runs `migrate.yml`
  against Infisical `dev` (Neon `dev`); a push to `main` runs it against
  Infisical `prd` (Neon `prd`). Each environment has its own `concurrency`
  group.
- **Runtime secrets come from Infisical `prd`** (0018 stays the source of
  truth): `/apps/web` via Infisical's Cloudflare Workers sync, `/apps/server`
  via its GCP Secret Manager sync, read by Cloud Run at deploy time.
  `VITE_API_URL` is a Workers Builds build variable.

## Consequences

- Migrate, `api` and `web` can all start on the same push to `main` with no
  ordering: migrations must be expand-then-contract, and a new web screen can
  briefly call an API that lacks its endpoint.
- Every migration replays on Neon `dev` before it reaches `prd`, but can still
  fail on `prd`'s data. Fix forward through `dev`. A hotfix straight into
  `main` must be merged back into `dev`.
- `api` scales to zero; the first request after idle waits for Spring to boot.
  A revision that fails its startup probe never takes traffic.
- A rotated `api` secret takes effect on the next deploy (re-run
  `deploy.yml`).
- The first deploy is ordered by hand: `api` first, then its URL into
  `VITE_API_URL`, then `web`.
- Cloud Run requires a GCP billing account even within the free tier. If SSR
  ever exceeds the Workers Free plan's 10 ms CPU per request, `web` moves to
  Workers Paid.
- The `web` Worker deploys with `wrangler deploy` run from `apps/web`, so
  Wrangler picks up the config the Vite build writes
  (`dist/server/wrangler.json`).
