# Deployment: web on Cloudflare Workers, API on Cloud Run

**Status:** agreed
**Owner:** Ong Zheng Kai
**Depends on:** `in-process-anomaly-inference.md` (lands first; removes
`apps/ml`)

## Problem

The app only runs locally (`pnpm dev`) or as a local Docker Compose stack.
Nothing is reachable from the internet, so nobody outside a developer's
machine can use it, and nothing redeploys when a PR lands on `main`.

## Target topology

Free default addresses only; no custom domain.

| Piece | Today | Deployed as | Address |
| --- | --- | --- | --- |
| `apps/web` (TanStack Start SSR) | Nitro `node-server` | **Cloudflare Worker** `web`, built by `@cloudflare/vite-plugin` (already in the working tree) | `https://web.<account>.workers.dev` |
| `apps/server` (Spring Boot, Java 25, ONNX in-process) | `apps/server/Dockerfile` | **Cloud Run service** `api`, image from that Dockerfile | `https://api-<hash>.asia-southeast1.run.app` |
| Images | none | Artifact Registry Docker repo `upkeep-ar-prd`, `asia-southeast1` | - |
| Postgres | Neon `dev` branch | **Neon `prd` branch** (Spring connects over JDBC) | - |
| Build and deploy | none | `web`: Workers Builds. `api`: GitHub Actions `deploy.yml`, keyless via Workload Identity Federation | - |
| Runtime secrets | Infisical `dev` | Infisical `prd`: `/apps/web` -> Infisical Cloudflare Workers sync; `/apps/server` -> Infisical GCP Secret Manager sync | - |

Region `asia-southeast1` (Singapore), the same metro as Neon `prd`
(`aws-ap-southeast-1`).

Why this shape:

- TanStack Start's official Cloudflare path (`@cloudflare/vite-plugin` with
  `viteEnvironment: { name: "ssr" }`, before `tanstackStart()`) is built and
  free; one build config, no Nitro.
- Java cannot run on Workers. Cloud Run runs the existing Spring image as-is,
  with no proxy Worker in front.
- The browser keeps calling Spring directly (0007): `VITE_API_URL` is the
  `api` run.app URL, set as a Workers Builds build variable.
- `workers.dev` and `run.app` are both on the Public Suffix List, so the
  AuthKit cookie is scoped to the `web` host alone. The API uses bearer
  tokens; the cross-site call needs CORS only.
- Cold starts accepted: `api` scales to zero, no min instances.

## Behaviour

`web` Worker (as built):

- `vite build` produces a Worker bundle via `@cloudflare/vite-plugin`;
  `apps/web/wrangler.jsonc` sets `main: "@tanstack/react-start/server-entry"`,
  `compatibility_date: "2026-10-01"`, `compatibility_flags: ["nodejs_compat"]`,
  `workers_dev: true`. No Nitro, no `apps/web/Dockerfile`, no compose `web`
  service.
- WorkOS server vars are Worker secrets and reach the WorkOS library through
  `process.env`: with `nodejs_compat` and a compatibility date on or after
  2025-04-01, `nodejs_compat_populate_process_env` is on by default and
  populates `process.env` from text bindings, secrets included
  ([compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)).

`api` Cloud Run service:

- Runs `apps/server/Dockerfile` (with the startup tuning below). Container port 8080; Cloud Run's
  injected `PORT` is 8080 and Spring reads `SERVER_PORT` (default 8080), so no
  code change.
- 1 vCPU, 2 GiB (JVM heap plus the onnxruntime native session; Cloud Run
  counts all memory against the limit), startup CPU boost on, request-based
  billing, concurrency 80, min instances 0, max instances 2.
- Startup probe `GET /health` on 8080 (already public in `SecurityConfig`),
  period 5 s, failure threshold 24 (2 min to boot). A revision that never
  passes never takes traffic; the previous one keeps serving.
- Env: secrets from Secret Manager (table below) plus
  `CORS_ALLOWED_ORIGINS=https://web.<account>.workers.dev`. Nothing secret in
  the image.
- Public (`allUsers` -> `roles/run.invoker`, set once by the human; CI never
  changes it).

Docker Compose: `server` stays as is (the image Cloud Run runs); no `web`.

## JVM tuning

From [Cloud Run's Java tips](https://docs.cloud.google.com/run/docs/tips/java).
Image changes are harmless locally, so compose keeps parity; Cloud Run-only
settings live in `deploy.yml`.

| Tip | Decision | Why |
| --- | --- | --- |
| Startup CPU boost | Adopt (`--cpu-boost`) | Free startup speed-up on scale-from-zero. |
| Minimal multi-stage image | Already done | JRE-only runtime stage. |
| Avoid nested jars | Adopt | `java -Djarmode=tools -jar app.jar extract` in the Dockerfile; plain jars load without unpacking. |
| Jib | Skip | The Dockerfile already builds; a second build path is YAGNI. |
| Container-aware JVM | Already done | Java 25 reads cgroup limits. |
| Heap vs native memory | Adopt (`JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=60` in `deploy.yml`) | Default heap is 25% of 2 GiB; 60% leaves ~800 MiB for onnxruntime native memory, metaspace and threads. Cloud Run only, so local runs keep defaults. |
| Native Memory Tracking | Skip | Diagnostic; enable only if an OOM shows up. |
| `TieredStopAtLevel=1` | Skip | Trades steady-state speed for startup; CPU boost and the AOT cache already cover startup. |
| AppCDS | Adopt, as the Java 25 AOT cache | A training run (`-XX:AOTCacheOutput`, `-Dspring.context.exit=onRefresh`) in the Dockerfile; started with `-XX:AOTCache`. Measured locally: ~2.0 s vs ~3.0 s to "Started". If the cache does not match the runtime JVM it is ignored, not fatal. No shade plugin needed: the extracted layout already gives plain jars. |
| Smaller thread stacks (`-Xss256k`) | Skip | 2 GiB is ample; StackOverflow risk for no measured need. |
| Fewer threads | Skip | Cloud Run concurrency 80 caps in-flight requests below Tomcat's 200 threads. |
| Reactive stack | Skip | Rewrite for no need. |
| Background work under request billing | No change | No `@Scheduled`/`@Async` in the server; Hikari validates connections on borrow, so a stale pool after idle is safe. |
| Reduce startup tasks / startup probe | Adopt the probe | `GET /health` startup probe; the ONNX session still loads eagerly. |
| Connection pool sizing | No change | 2 instances x Hikari's default 10 = 20, well under Neon's limit. |
| Lazy initialization | Skip | With scale to zero it only moves the init cost (including the ONNX session) onto the first user request. |
| Avoid class scanning | Skip | Speculative for an app this size. |
| DevTools out of prod | Already done | `spring-boot-maven-plugin` excludes optional DevTools from the jar. |

## Delivery

### `web`: Workers Builds

Git-connected Worker `web`, production branch `main`, **non-production branch
builds off** (a preview shares production's secrets), root directory = repo
root.

| Setting | Value |
| --- | --- |
| Build command | `pnpm install --frozen-lockfile && pnpm nx build web` |
| Deploy command | `cd apps/web && npx wrangler deploy` (picks up the `dist/server/wrangler.json` the Vite build writes) |
| Watch paths | `apps/web/**`, `packages/{api,ui,env}/**` |
| Build variables | `VITE_API_URL=https://api-<hash>.asia-southeast1.run.app`, `SKIP_ENV_VALIDATION=1` |

No Cloudflare token lives in GitHub.

### `api`: GitHub Actions + Workload Identity Federation

Chosen over a Cloud Build trigger: the repo already deploys migrations from
Actions with OIDC (0027), the config lives in git, path filters are native,
and the image builds from the repo root with no `cloudbuild.yaml` or GitHub
App. GitHub stores no GCP key, only repository variables: `GCP_PROJECT_ID`,
`GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_API_RUNTIME_SA`, `WEB_URL`.

`.github/workflows/deploy.yml`:

```yaml
name: Deploy API

# Builds apps/server's image and deploys it to Cloud Run on every push to main
# that touches the server. The web app deploys separately via Workers Builds.
on:
  push:
    branches: [main]
    paths:
      - apps/server/**
      - pom.xml
  workflow_dispatch:

permissions:
  contents: read
  # Lets the job mint a GitHub OIDC token for Workload Identity Federation.
  id-token: write

concurrency:
  group: deploy-api-prd
  cancel-in-progress: false

env:
  REGION: asia-southeast1
  IMAGE: asia-southeast1-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/upkeep-ar-prd/api:${{ github.sha }}

jobs:
  deploy:
    name: Deploy api to Cloud Run
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOY_SA }}

      - name: Set up gcloud
        uses: google-github-actions/setup-gcloud@v3

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet

      # Build context is the repo root: the Dockerfile needs the root pom.xml
      # and Maven wrapper.
      - name: Build and push image
        run: |
          docker build -f apps/server/Dockerfile -t "$IMAGE" .
          docker push "$IMAGE"

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v3
        with:
          service: api
          region: ${{ env.REGION }}
          image: ${{ env.IMAGE }}
          # JAVA_TOOL_OPTIONS is Cloud Run only, so local compose keeps the JVM
          # defaults: let the heap use 60% of the 2 GiB limit (default 25%),
          # leaving the rest for onnxruntime's native memory and the JVM.
          env_vars: |-
            CORS_ALLOWED_ORIGINS=${{ vars.WEB_URL }}
            JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=60
          env_vars_update_strategy: overwrite
          secrets: |-
            SPRING_DATASOURCE_URL=SPRING_DATASOURCE_URL:latest
            SPRING_DATASOURCE_USERNAME=SPRING_DATASOURCE_USERNAME:latest
            SPRING_DATASOURCE_PASSWORD=SPRING_DATASOURCE_PASSWORD:latest
            WORKOS_API_KEY=WORKOS_API_KEY:latest
            SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI:latest
            SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES=SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES:latest
          secrets_update_strategy: overwrite
          flags: >-
            --service-account=${{ vars.GCP_API_RUNTIME_SA }}
            --port=8080
            --cpu=1
            --memory=2Gi
            --cpu-boost
            --concurrency=80
            --min-instances=0
            --max-instances=2
            --startup-probe=httpGet.path=/health,httpGet.port=8080,periodSeconds=5,failureThreshold=24,timeoutSeconds=3
```

`CORS_ALLOWED_ORIGINS` comes from the `WEB_URL` repository variable rather
than Secret Manager: it is not secret and is needed as plain env. The image is
tagged with the commit SHA; rollback is routing traffic to the previous
revision (`gcloud run services update-traffic api --to-revisions=...`).

## Branch flow

A long-lived git branch `dev` sits between feature branches and `main`:
`feat/*` -> PR into `dev` -> PR `dev` into `main`.

| Event | GitHub Actions | Neon | Deploys |
| --- | --- | --- | --- |
| PR into `dev` or `main` | `pr-checks.yml` (trigger widened to both) | ephemeral Postgres only (0012) | - |
| Push to `dev` | `migrate.yml` with Infisical `dev` | `dev` branch | nothing |
| Push to `main` | `migrate.yml` with Infisical `prd`; `deploy.yml` if server changed | `prd` branch | `api` to Cloud Run; Workers Builds deploys `web` if its watch paths changed |

`migrate.yml` (0027, already implemented) triggers on push to `dev` and
`main` (paths `packages/db/prisma/**`, plus `workflow_dispatch`). The branch
picks the Infisical environment - `dev` -> `dev`, `main` -> `prd` - and
exports `DATABASE_URL` (direct, non-pooler URL) from `/packages/db`. One
`concurrency` group per environment. The Infisical OIDC identity is bound to
those two branches only. Every migration replays on Neon `dev` before it can
reach `prd`.

## Secrets per service

Infisical stays the source of truth (0018), in a `prd` environment mirroring
the `dev` folders. Each folder syncs to its own provider, so the duplicated
`WORKOS_API_KEY` is just two copies of one Infisical value per folder.

| Service | Infisical `prd` folder | Sync | Secrets |
| --- | --- | --- | --- |
| `web` | `/apps/web` | Cloudflare Workers sync -> Worker `web` secrets | `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_REDIRECT_URI` |
| `api` | `/apps/server` | GCP Secret Manager sync (auto sync, key schema `{{secretKey}}`) | `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `WORKOS_API_KEY`, `SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI`, `SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES` |

Cloud Run reads `:latest` at deploy time; a rotated `api` secret takes effect
on the next deploy (run `deploy.yml` manually). The `api` runtime service
account has `roles/secretmanager.secretAccessor` on these secrets only.

## One-time manual setup (human)

1. GitHub: create `dev` from `main`, protect both, make `dev` the default PR
   target.
2. Neon: create `prd` from `dev` (region `aws-ap-southeast-1`).
3. GCP: project linked to the billing account (required even within the
   free tier); enable Cloud Run, Artifact Registry, Secret Manager, IAM
   Credentials APIs; Artifact Registry repo `upkeep-ar-prd` in `asia-southeast1` with a
   cleanup policy keeping the 3 newest images; a budget alert (e.g. USD 5).
4. GCP IAM: Workload Identity pool + GitHub OIDC provider with attribute
   condition `assertion.repository == 'notsql/CS203' && assertion.ref ==
   'refs/heads/main'`; deploy SA (`roles/run.admin`,
   `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser` on the
   runtime SA) impersonable by that provider; runtime SA `api-runtime`.
5. Infisical: `prd` environment pointed at Neon `prd`; the existing OIDC
   identity can read it; GCP connection + Secret Manager sync for
   `/apps/server`; Cloudflare connection + Workers sync for `/apps/web`. No
   blank values.
6. **First deploy, in this order:**
   1. Run `deploy.yml` by hand; grant `allUsers` `roles/run.invoker` on `api`.
   2. Put the `api` run.app URL into the Workers Builds `VITE_API_URL`.
   3. Put `https://web.<account>.workers.dev` into the `WEB_URL` repository
      variable (`CORS_ALLOWED_ORIGINS`) and Infisical `prd`
      `/apps/web/WORKOS_REDIRECT_URI`; re-run `deploy.yml`.
   4. Connect the repo in Workers Builds with the settings above; it builds
      and deploys `web`.
7. WorkOS: production environment with the `web` redirect URI and origin,
   and the JWT issuer/audience for Spring.
8. Install: after the revert below, run `pnpm install` to refresh the lock.

## Cost estimate

- `web`: Workers Free plan, 100,000 requests/day, 10 ms CPU per request
  ([limits](https://developers.cloudflare.com/workers/platform/limits/)).
  USD 0.
- `api`: request-based billing, scale to zero, so idle is free. Monthly free
  tier per billing account: 180,000 vCPU-s, 360,000 GiB-s, 2 million requests
  ([pricing](https://cloud.google.com/run/pricing)). At 2 GiB that is ~50
  hours of active instance time a month, ample for a class project.
- Paid extras: Artifact Registry storage beyond the free 0.5 GB (~2 GB with
  the cleanup policy), Secret Manager versions beyond the free tier (6
  secrets), egress beyond the free allowance.
- **Expected: under USD 1/month.**

## Data

No Prisma changes. A new Neon branch `prd` holds production data.

## API

No contract changes. The public API moves from `http://localhost:8080` to the
`api` run.app URL.

## Edge cases

- **No ordering between migrate, `api` and `web`.** All can start on the same
  push to `main`. Migrations must be expand-then-contract, and a web change
  calling a new endpoint can briefly hit an API without it (Workers Builds is
  usually faster than the Java image build).
- A migration can succeed on `dev` and fail on `prd`. Fix forward through
  `dev` (0027). A hotfix PR straight into `main` must be merged back into
  `dev`.
- `prisma migrate deploy` needs Neon's direct URL; Spring can use the pooled
  one.
- Blank `SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI` takes Spring
  down: never create it empty in Infisical `prd`. The startup probe fails and
  the previous revision keeps serving.
- A change to `packages/api` alone redeploys only `web`; correct, since the
  server change that produced it already deployed.
- The `api` URL changes only if the service is deleted and recreated; then
  `VITE_API_URL` must be updated and `web` rebuilt.
- Cold start: the first request after scale-to-zero waits for Spring to boot.
  Accepted.
- OOM: if heap plus the ONNX session exceeds 2 GiB the instance is killed;
  raise `--memory`.
- Free-plan Worker CPU is 10 ms per request; SSR pages that exceed it fail
  with an error. Unlikely; if it happens, move `web` to Workers Paid
  (accepted by the owner).

## Reverting the Cloudflare `api` work

The `web` Worker stays exactly as built. Implementation undoes only the
`api` Worker/Container in the working tree:

- Delete `apps/server/worker/` (untracked).
- Remove `apps/server/worker` from `packages` in `pnpm-workspace.yaml` and
  from `workspaces` in the root `package.json`.
- Remove catalog entries used only by the worker: `@cloudflare/vitest-plugin`,
  `@cloudflare/workers-types` (nothing in `apps/web` or `packages/` imports
  either). Keep `wrangler` and `@cloudflare/vite-plugin` (web).
- Remove `minimumReleaseAgeExclude` entry `@cloudflare/vitest-plugin@1.4.4`.
  Keep `wrangler@4.151.1` and `miniflare@5.20261012.1-beta` (the lockfile
  shows `wrangler@4.151.1` depends on that miniflare).
- Rewrite decision 0029 (untracked) as
  `0029-deploy-web-to-workers-and-api-to-cloud-run.md`, keeping the web,
  branch-flow and migration content and replacing the Container parts.
- Docs that describe the `api` Worker/Container: `AGENTS.md` (stack table
  "Hosting" row; the paragraph saying compose's `server` builds the image the
  Cloudflare Container runs), `.spec/architecture.md` (projects table
  `apps/server/worker` / `api-worker` row, the deployment section's `api`
  rows and reference to `features/cloudflare-deployment.md`, the testing
  table `apps/server/worker` row), `README.md` (compose note, tree comment
  `+ worker/`, the "image the Cloudflare Container runs" sentence, the
  deployment paragraph citing 0029).
- Kept: `apps/web/wrangler.jsonc`, `apps/web/vite.config.ts`,
  `apps/web/package.json`, `apps/web/vitest.config.ts` comment, the staged
  deletion of `apps/web/Dockerfile`, compose without `web`, `migrate.yml`, the
  `pr-checks.yml` rename.
- `pnpm-lock.yaml`: refreshed by the human's `pnpm install`.

## Out of scope

- A custom domain.
- Min instances / keep-warm for `api`.
- Preview or `dev` deployments of either service.
- Moving the database off Neon.
- Replacing Infisical with Secret Manager or Cloudflare Secrets Store.
- Terraform for the one-time setup.
