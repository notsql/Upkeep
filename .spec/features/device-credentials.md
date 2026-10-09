# Device credentials

**Status:** draft
**Owner:** ID-42

## Problem

Anything that can reach the API could claim to be a sensor. Before readings
are accepted (ID-43), each device needs its own secret, so a reading can be
traced to exactly one registered device and a leaked secret can be cut off
without touching any other device.

## Behaviour

- An estate owner can generate an API key for a device registered in that estate. No browser login is involved on the device side.
- The server generates the key: `upk_` followed by 32 random bytes, base64url-encoded. WorkOS is not involved (decision 0025).
- The full key is returned once, in the response that creates it. It is never stored, logged or returned again.
- Only a SHA-256 hash of the key is stored, on the device row, together with the time it was issued.
- Generating a key for a device that already has one replaces it. From that moment the previous key is rejected.
- Replacement is the only way to revoke a key in this story. Revocation by deactivating a device belongs to ID-45.
- A device sends its key as `Authorization: Bearer upk_...` to `/device-api/**`.
- A missing, malformed, unknown or replaced key is rejected with 401 and one generic message, so the response does not reveal which case applied.
- `/device-api/**` always requires a device key, including when the JWT issuer is unset and the rest of the API is open for local development.
- A device key is never accepted on manager endpoints, and a user's JWT is never accepted on `/device-api/**`.
- The device's identity, asset and estate come only from the key. Device endpoints accept no device, asset or estate ID from the caller, so a device cannot act as another device or reach another estate's assets.
- `DeviceResponse` gains `credentialIssuedAt` (null when no key has been issued). The asset page shows whether a key exists and offers Generate credential or Replace credential.
- The key is shown in a dialog with a copy button and a warning that it will not be shown again. Replace credential first asks for confirmation, stating that the current key stops working immediately.

## Data

`Device` gains:

- `credentialHash` - nullable, `@unique`, 64-character hex SHA-256 of the key.
- `credentialIssuedAt` - nullable `timestamptz`.

No separate credential table: one active key per device, and replacement
overwrites the hash (decision 0025).

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | /estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential | - | 201 DeviceCredentialResponse | Owner |

`DeviceCredentialResponse`: `deviceId`, `apiKey` (the plaintext key, this one
time), `issuedAt`.

## Edge cases

- Devices registered before this story have no key and cannot submit readings until one is generated.
- An unknown device, a device on another asset or estate, or an estate the caller does not own returns 404.
- Generating a key for a device on a retired asset or in an inactive estate returns 409, matching registration. A key issued earlier keeps working once the asset is restored.
- Two replacements at the same moment: the later write wins and only its key works. The owner who received the other key sees it rejected and generates again.
- Lookup is by hash through the unique index. The key has 256 bits of entropy, so a fast hash is enough and bcrypt is not needed.
- Request logging must not record the `Authorization` header on `/device-api/**`.

## Out of scope

- mTLS and certificate issuance (decision 0025).
- Revoking without replacement, and revocation on device deactivation (ID-45).
- Several active keys per device, key expiry and rotation schedules.
- Council members managing credentials. Device management stays owner-only.
- Rate limiting device requests.
