# Transactional email via Resend

**Status:** draft
**Owner:** Ong Zheng Kai

## Problem

Work-order dispatch emails go out over Gmail SMTP (`spring-boot-starter-mail`,
`SmtpWorkOrderEmailSender`), signed in with an app password on a personal
Gmail account. That is a workaround, not a service. Over SMTP, the only errors
we get back are text replies, so we work out "too large" by looking for "552"
in the message. Production has no mail settings at all: `deploy.yml` passes no
`SPRING_MAIL_*` variables, so every dispatch in `prd` is recorded as
`MAIL_NOT_CONFIGURED` and no contractor gets an email.

Decision 0048 chose Gmail SMTP and turned down HTTP APIs without giving a
reason. Decisions 0021 and 0028, and `notifications.md`, all say there is no
transactional email service. This spec adds one: Resend, called over HTTP
with the official `resend-java` SDK. It becomes the only path for outbound
email. Another spec in this round adds assignment emails to contractors, so
the port is made general enough for that spec to reuse.

## Behaviour

Sender and wiring

- The port becomes `EmailSender` with `void send(OutboundEmail)`, and it
  throws `EmailSendException(code, message)`. These replace
  `WorkOrderEmailSender` and `WorkOrderSendException`.
- `OutboundEmail` is a record with `to` (one address), `subject`, `text`
  (plain text), `replyTo` (optional), and `attachments`, a list of
  `(filename, contentType, bytes)` that may be empty. It does not contain
  anything specific to work orders.
- `WorkOrderEmail.build(...)` still decides the content, and now returns an
  `OutboundEmail`. Its subject, body and attachment rules stay the same.
- The only implementation is `ResendEmailSender`. A sender bean exists if and
  only if `RESEND_API_KEY` (`app.mail.resend-api-key`) is set and not blank.
  Without it there is no bean, and `DispatchDeliveryJob` records
  `MAIL_NOT_CONFIGURED`, the same as today.
- When the key is set, `APP_MAIL_FROM` is required. If it is missing or blank,
  startup fails with a message that names the variable. There is no fallback
  to a username, because Resend only sends from an address on a verified
  domain.
- The sender value is `APP_MAIL_FROM`, unchanged. It can be a bare address or
  `Name <address>`.
- If `APP_MAIL_REPLY_TO` is set, it becomes the reply-to on every message,
  unless the `OutboundEmail` has its own `replyTo`. If it is unset, no
  reply-to is sent.
- Each attachment is sent as base64 content with its filename through the SDK
  (`Attachment.builder().fileName(..).content(base64)`). Attachments are never
  sent as URLs, because the photo URLs are private S3 keys.
- `spring-boot-starter-mail`, `SmtpWorkOrderEmailSender`, the
  `spring.mail.*` block in `application.yaml` and the `SPRING_MAIL_*`
  variables are removed. `MailConfig` now builds the Resend sender instead.

Error mapping (the codes recorded on `WorkOrderDispatch`)

- HTTP 401 or 403 from Resend → `AUTH`.
- HTTP 413, or a Resend error that says an attachment or the payload is too
  large → `MESSAGE_TOO_LARGE`.
- HTTP 422 (validation, such as a bad address or an unverified from domain) →
  `MESSAGE_INVALID`.
- HTTP 429, any 5xx, a timeout, or a network failure → `PROVIDER_ERROR`.
- Anything else the SDK throws → `PROVIDER_ERROR`.
- The `DispatchDeliveryJob` retry rules do not change: it polls every 15
  seconds, takes batches of 20, holds a 3-minute lease, and gives up after 5
  attempts. Every failure code goes into the same attempt and backoff path as
  today. This spec does not add a new idea of failures that are never retried.
- When `WorkOrderEmail.build` refuses to build a message (for example, an
  empty contractor address), it still records `MESSAGE_INVALID`.

Renamed codes

- `SMTP_AUTH` becomes `AUTH`, and `SMTP_ERROR` becomes `PROVIDER_ERROR`.
  This is safe because nothing outside the server reads these strings. A
  search found them only in `.docs/api/report-routing.md:51` and in the server
  source. They do not appear in `packages/api/openapi.json` (the failure code
  is a plain `string` there) or anywhere in `apps/web/src`. The web app does
  not show or branch on the code. `.docs/api/report-routing.md` is updated in
  the same change. Old dispatch rows keep the old strings; they are history,
  so no backfill.

## Data

None. No Prisma change.

## API

No contract change. `pnpm api:generate` should produce no diff.

## Dependency

- Add `com.resend:resend-java` to `apps/server/pom.xml`, using the latest
  stable release. The version is an open question below. A human installs it
  (AGENTS.md rule 1).
- Remove `spring-boot-starter-mail`.
- Remove the Mailpit Testcontainer test (`SmtpWorkOrderEmailSenderTests`) and
  any Mailpit-only test dependency it needed.

## Tests (written first, seen failing)

- `ResendEmailSenderTests` is a plain unit test against a stubbed
  `Resend`/`Emails` client. If the SDK's types cannot be stubbed, it uses a
  JDK `HttpServer` stub with the SDK's base URL pointed at it, the same way
  the S3 tests do. It covers:
  - Success: the request carries the from, to, subject, text and reply-to, and
    each attachment as base64 with its filename.
  - No reply-to is sent when none is configured.
  - 401 maps to `AUTH`.
  - 413 or an attachment-too-large error maps to `MESSAGE_TOO_LARGE`.
  - 422 maps to `MESSAGE_INVALID`.
  - 429, 500 and an I/O failure map to `PROVIDER_ERROR`.
- `MailConfig` test: no bean exists without `RESEND_API_KEY`, and startup
  fails when the key is set but `APP_MAIL_FROM` is not.
- `WorkOrderEmailTests` is changed to assert on the `OutboundEmail` it
  returns. This change of return type is its own change.
- `ReportRoutingIntegrationTests` keeps mocking the port, now as
  `@MockitoBean EmailSender`.

## Deploy and config

- Infisical `/apps/server`, in both `dev` and `prd`: `RESEND_API_KEY`,
  `APP_MAIL_FROM`, and `APP_MAIL_REPLY_TO` (optional). Remove
  `SPRING_MAIL_HOST`, `SPRING_MAIL_PORT`, `SPRING_MAIL_USERNAME` and
  `SPRING_MAIL_PASSWORD`. A human adds the values, and no secret is created
  with an empty value.
- `.github/workflows/deploy.yml` passes all three to `upkeep-server-prd`
  through its secrets mapping.
- `apps/server/.env.example` and `packages/env` (if the server's variables
  are listed there) are updated to match.
- Verifying the sending domain in Resend (DNS records for SPF and DKIM) is a
  human step and must happen before prod sends anything. Until then, Resend
  returns 422 and dispatches record `MESSAGE_INVALID`.
- A new decision record supersedes the transport choice in 0048 and gives the
  reason. Its number is assigned at build time, because another spec in this
  round reserves 0050. `.docs/api/report-routing.md` (the failure codes and
  the env table) is updated in the same change.

## Edge cases

- The key is set but the domain is not verified: you get 422 →
  `MESSAGE_INVALID`. This is retried within the 5 attempts like any other
  failure and then gives up. It is visible on the dispatch row.
- A message over Resend's size limit: the photos make up most of the size.
  The existing per-photo selection in `WorkOrderEmail.build` is kept. If the
  total is still too big, the result is `MESSAGE_TOO_LARGE` from Resend. The
  sender does not check the size before sending.
- Rate limiting (429) during a burst of dispatches: this is recorded as
  `PROVIDER_ERROR` and the next poll retries it. There is no in-process sleep
  or retry.
- An invalid API key in prod gives `AUTH` on every dispatch. The fix is to
  correct the key; the outbox needs no special handling.
- Duplicate sends after a lease expires mid-request behave the same as with
  SMTP today. Resend's idempotency key is not used (see Out of scope).

## Out of scope

- Email for notifications or invitations. WorkOS sends the invitations, and
  notifications stay in-app.
- Resend webhooks for delivery, bounce or complaint status.
- HTML or templated email. Messages stay plain text.
- Storing the Resend message id (`providerMessageId`) on `WorkOrderDispatch`.
  Nothing reads it until webhooks exist, so it is not added (YAGNI).
- Resend idempotency keys and batch sending.
- Several recipients, cc or bcc on `OutboundEmail`.

## Open questions

- Which `resend-java` version to use. Maven Central was not checked while
  writing this spec, so the human picks the latest stable release and
  confirms it runs on Java 25.
- The size limit. This spec assumes 40 MB per email, counted after base64
  encoding, based on Resend's documented limit. Confirm it against current
  Resend docs. Also confirm whether "too large" comes back as 413 or as a 422
  with an error name, so the mapping test uses the real shape.
- Does the SDK expose the HTTP status on its exception (`ResendException`)? If
  it does not, the mapping falls back to Resend's error `name`
  (`validation_error`, `rate_limit_exceeded`, ...). This changes how the sender
  is written, not how it behaves.
- Which domain and from address to verify for `dev` and for `prd`, and
  whether `dev` should send real email or use Resend's test address
  (`onboarding@resend.dev` to the account owner only).
