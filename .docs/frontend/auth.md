# Authentication (frontend)

WorkOS AuthKit via `@workos/authkit-tanstack-react-start`. The session lives in
an encrypted HTTP-only cookie; the browser never sees the refresh token. Paths
are relative to `apps/web/src/`.

## Routes

| File | URL | Kind | Behaviour |
| --- | --- | --- | --- |
| `routes/login/index.tsx` | `/login` | page | Search: `error?: string`, `returnTo` (sanitised, default `/`). Shows an alert for `error=auth_unavailable` or any other error, and a "Continue to secure sign in" link to `buildSignInPath(returnTo)`. Title "Sign in". Exports `LoginPage` for tests. |
| `routes/register/index.tsx` | `/register` | page | Search: `error?: string`. "Create account" link to `/api/auth/sign-up`; alert when `error` is set. Title "Create an account". Exports `RegistrationPage`. |
| `routes/logout/index.tsx` | `/logout` | page + loader | Search: `returnTo` (sanitised). Loader calls AuthKit `signOut({ data: { returnTo } })`. Renders "Signing out..." (`role="status"`) with a decorative `Spinner`. |
| `routes/api/auth/sign-in/index.tsx` | `GET /api/auth/sign-in` | server handler | Sanitises `returnPathname`; when `invitation_token` is present, forwards it on the AuthKit authorization URL and returns to `/estates`. Preserves PKCE/state. Responds 307. On failure 303 to `/login?error=auth_unavailable`. |
| `routes/api/auth/sign-up/index.tsx` | `GET /api/auth/sign-up` | server handler | 307 to `getSignUpUrl` with `returnPathname: "/account"`. On failure 303 to `/register?error=auth_unavailable`. |
| `routes/api/auth/callback/index.tsx` | `GET /api/auth/callback` | server handler | `handleCallbackRoute`; on error redirects to `/login?error=auth_failed`. |
| `routes/_auth/route.tsx` | pathless layout `_auth` | guard | `beforeLoad` authenticates and awaits Spring access before management child loaders run; no user redirects to the same-origin sign-in path. Resident estate deep links redirect to `/reports/new`; other estate permissions remain independent. Reporting/account routes need authentication only. Returns `{ user }` as loader data (read by `/account`). Component is `Outlet`. Every route under `routes/_auth/` is behind this guard. |

The login and register pages are a shadcn `Card` (`role="region"` named by the
`<h1>` inside `CardTitle`; `CardHeader`, `CardDescription`, `CardContent`). The
error is a destructive `Alert` with an `AlertDescription`, and the hosted
sign-in/sign-up link is an `<a>` styled with `buttonVariants({ size: "lg" })`.

## Components

| File | Role | shadcn |
| --- | --- | --- |
| `components/auth-provider.tsx` | `AuthProvider` = `AuthKitProvider` > `AuthTokenBridge` > `AuthIdleGuard`. `AuthTokenBridge` installs `useAccessToken().getAccessToken` as the API client's token resolver (`setAccessTokenResolver`); failures resolve to `undefined`. | - |
| `routes/-components/auth-idle-guard.tsx` | `AuthIdleGuard({ timeoutMinutes })`. When a user is signed in, resets a timer on `keydown`, `pointerdown`, `scroll`, `touchstart`; on expiry calls `startServerSignOut("/login")`. Timeout from `VITE_AUTH_IDLE_TIMEOUT_MINUTES` (default 30). | - |
| `components/auth-button.tsx` | Header button. Loading: disabled ghost `Button` "Loading...". Signed out: "Sign in" link to `/api/auth/sign-in` styled with `buttonVariants({ size: "sm" })`. Signed in: circular profile Button opens a DropdownMenu with user email, Settings linking to `/account`, and Sign out linking to `/logout`. | `Button`, `buttonVariants`, `DropdownMenu` |

## Helpers (`lib/auth-redirect.ts`)

| Function | Does |
| --- | --- |
| `sanitizeReturnTo(value)` | Returns a same-origin relative path, else `/`. Rejects non-strings, values not starting with `/`, and cross-origin URLs. |
| `buildSignInPath(returnTo)` | `/api/auth/sign-in?returnPathname=<sanitised>` |
| `buildSignOutPath(returnTo)` | `/logout?returnTo=<sanitised>` |
| `startServerSignOut(returnTo)` | `window.location.assign(buildSignOutPath(returnTo))` |

## Endpoints

None on the Spring API. All auth traffic goes to the web app's own server
handlers above and to WorkOS. The access token is attached to Spring calls by
the API client, never by hand.

## Roles

Spring's `GET /access/context` drives navigation, Home and protected estate routes. WorkOS supplies identity; estate permissions come from current `EstateUser` rows and estate ownership. Provider admin claims grant no platform access. A JWT resident claim neither grants reporting access nor removes management access in another estate. The My reports navigation destination requires a current Resident membership; direct access to owned historical reports remains available after membership deletion. See [resident-reports.md](resident-reports.md) and [API access](../api/access.md).

Every authenticated account has `canCreateEstate=true`. The `_auth` guard permits
`/estates`, `/estates/`, `/estates/new` and `/estates/new/` before the workspace
gate, after authentication and access resolution. Creation checks that capability
for both slash variants. Specific estate routes retain their own capability checks.
Creation refreshes client access before navigating; the destination guard resolves
current server access, so a first-time creator can enter their new estate immediately.

## Council invitation sign-in

The invitation-token branch above is for new-account WorkOS email invitations.
Existing-account invitations use ordinary sign-in and explicit acceptance on Estates. See [council-invitations.md](council-invitations.md) for both flows.

## Presentation

Local authentication cards share the dashboard light/dark tokens and rounded,
readable shadcn controls. The public header includes the saved theme toggle.
WorkOS-hosted authentication and all redirect/session behavior stay the same.
See [design-system.md](design-system.md).

Public home has one Create account action in its content; the header no longer
repeats it as Register. Header and home both use Sign in for authentication.
The existing signup/sign-in endpoints and redirects remain unchanged.


Invitation recipients return to /invitations with AuthKit PKCE/state preserved.
The _auth guard requires identity for that page without workspace capability,
so unassigned, Resident-only and Crew-only accounts can accept offers.


## Fault report responder entry

`/estates/$estateId/reports` and its detail route require the target estate's
`canViewFaultReports` before child loading. This allows Crew without general
management access and denies Council/provider-role bypass. Home redirects an
account with report access but no management estate into its first assigned
report estate. `canRelocateFaultReports` controls correction availability; the
server independently rechecks membership/activity. See [estate-reports.md](estate-reports.md).
