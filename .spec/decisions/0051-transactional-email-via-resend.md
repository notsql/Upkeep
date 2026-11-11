# 0051 - Transactional email goes through Resend

**Status:** accepted. Supersedes the SMTP transport choice in 0048. Spec:
`.spec/features/transactional-email-via-resend.md`.

## Context

0048 sent work-order emails over Gmail SMTP with an app password on a personal
account, and turned down HTTP email APIs without a reason. SMTP only returns
text replies, so "too large" was guessed by looking for "552". Production had
no mail settings, so every `prd` dispatch recorded `MAIL_NOT_CONFIGURED`.
Assignment emails to contractors are coming and need the same path.

## Decision

- **Resend over HTTP** with the official `com.resend:resend-java` SDK is the
  only outbound email path. `spring-boot-starter-mail` is removed.
- **A general port:** `EmailSender.send(OutboundEmail)` throwing
  `EmailSendException(code)`. `OutboundEmail` carries one recipient, subject,
  plain text, an optional reply-to and base64 attachments - nothing specific
  to work orders. `ResendEmailSender` is the only implementation.
- **The sender exists only when `RESEND_API_KEY` is set**; `APP_MAIL_FROM` is
  then required and startup fails without it.
- **Failure codes come from HTTP status:** `AUTH`, `MESSAGE_TOO_LARGE`,
  `MESSAGE_INVALID`, `PROVIDER_ERROR` (renamed from `SMTP_AUTH` and
  `SMTP_ERROR`; old rows are not backfilled).

Rejected: keeping Gmail SMTP (not a service, opaque errors, personal account);
other providers (Resend's Java SDK and free tier fit, and nothing else here
needs choosing between them).

## Consequences

- The sending domain must be verified in Resend (SPF/DKIM) before `prd` sends;
  until then dispatches record `MESSAGE_INVALID`.
- Retry rules are unchanged. No webhooks, message ids or idempotency keys yet.
