# 0041 - Fault report classification runs in Spring

**Status:** accepted (ID-70). Departs from the vision document, which put
inference in a separate Hono service on Cloudflare Workers.

## Context

ID-70 needs a model to read a resident's fault report (text and photos) and
say whether it is a pump, lift, gate or common-area light fault. The vision
document planned a Hono service on Workers for model calls. No such service
exists. Spring AI's Anthropic chat auto-configuration is excluded in
`application.yaml` because 2.0.1 fails to bind under Spring Boot 4.1.1.

The classifier needs the report row, the private R2 photos and the estate's
contractors - all of which only Spring can read (rule 4, decision 0026).

## Decision

- **Spring calls Claude in process**, as it runs the anomaly model (0028).
  `AnthropicFaultClassifier` uses the official Anthropic Java SDK
  (`com.anthropic:anthropic-java-core`), which the Spring AI starter already
  brings in, through `AnthropicSetup.setupSyncClient`. The broken
  auto-configuration stays excluded; no new dependency is added.
- Model `claude-haiku-5-5` (`app.routing.model`), structured outputs
  constrained to the answer record, 30-second timeout, one SDK retry.
- Classification runs in a scheduled job after the submission commits
  (`ReportClassificationJob`), never in the resident's request. A confident,
  routable answer creates an ID-36 work order (decision 0042). The model
  call happens outside any database transaction; a lease on `ReportRouting`
  keeps two API instances from classifying the same report.
- The confidence threshold for automatic routing is a fixed `0.80`.

Rejected: a Hono Worker (it would need its own R2 credentials, a way to
authenticate to the API, a second deploy and a network hop - the costs 0028
removed); calling the model synchronously during submission (a slow or failed
model call would fail or delay the resident's report).

## Consequences

- `ANTHROPIC_API_KEY` is a server secret. Without it every report goes to the
  managing agent ("Automatic classification unavailable").
- Resident text and photos are sent to Anthropic; the report form says so.
- Classification quality is checked by the opt-in
  `AnthropicFaultClassifierEvaluationTests`, not by CI.
