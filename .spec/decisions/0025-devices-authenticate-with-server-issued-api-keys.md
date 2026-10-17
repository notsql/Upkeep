# 0025 - Devices authenticate with server-issued API keys

## Status

Proposed.

## Decision

Spring issues each device its own API key, `upk_` plus 32 random bytes
(base64url). The plaintext key is shown once. The `Device` row stores only a
SHA-256 hash and the time it was issued. A device sends the key as a bearer
token to `/device-api/**`, which has its own security filter chain. That chain
always requires a device key, even when the JWT issuer is unset, and never
accepts a user's JWT. Generating a new key overwrites the hash, which revokes
the old key.

The key alone identifies the device. Device endpoints take no device, asset or
estate ID from the request, so a device cannot act for another device or
another estate.

Rejected:
- **mTLS.** The private key never leaves the device, which is stronger. It
  needs a certificate authority, certificate issuance per device, and a host or
  proxy that passes client certificates through to Spring. That is too much
  infrastructure for the current scope.
- **WorkOS M2M credentials or API keys.** WorkOS manages people and
  organisations. Using it would make every reading depend on a third-party
  service, and would mean provisioning one WorkOS client per sensor.
- **The device's identifier as the credential.** It is a printed label that
  managers type in (decision 0016), not a secret.
- **bcrypt or argon2 for the hash.** They protect low-entropy passwords. A
  256-bit random key cannot be guessed, and a slow hash would cost time on
  every reading.
- **A separate credential table.** There is one active key per device, and
  nothing needs key history yet.

## Consequences

A leaked key can send readings until an owner replaces it. Replacement is the
only way to revoke a key until ID-45 adds device deactivation. The
`/device-api` filter chain must be ordered before the main chain, or local
development, where the main chain allows everything, would accept
unauthenticated readings.
