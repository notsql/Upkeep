# Authentication (frontend)

WorkOS AuthKit via `@workos/authkit-tanstack-react-start`. The session lives in
an encrypted HTTP-only cookie; the browser never sees the refresh token. Paths
are relative to `apps/web/src/`.

## Routes

| File | URL | Kind | Behaviour |
| --- | --- | --- | --- |
| `routes/login.tsx` | `/login` | page | Search: `error?: string`, `returnTo` (sanitised, default `/`). Shows an alert for `error=auth_unavailable` or any other error, and a "Continue to secure sign in" link to `buildSignInPath(returnTo)`. Title "Sign in". Exports `LoginPage` for tests. |
| `routes/register.tsx` | `/register` | page | Search: `error?: string`. "Create account" link to `/api/auth/sign-up`; alert when `error` is set. Title "Create an account". Exports `RegistrationPage`. |
| `routes/logout.tsx` | `/logout` | page + loader | Search: `returnTo` (sanitised). Loader calls AuthKit `signOut({ data: { returnTo } })`. Renders "Signing out..." (`role="status"`) with a decorative `Spinner`. |
| `routes/api/auth/sign-in.tsx` | `GET /api/auth/sign-in` | server handler | Reads `returnPathname`, sanitises it, 307 to `getSignInUrl`. On failure 303 to `/login?error=auth_unavailable`. |
| `routes/api/auth/sign-up.tsx` | `GET /api/auth/sign-up` | server handler | 307 to `getSignUpUrl` with `returnPathname: "/account"`. On failure 303 to `/register?error=auth_unavailable`. |
| `routes/api/auth/callback.tsx` | `GET /api/auth/callback` | server handler | `handleCallbackRoute`; on error redirects to `/login?error=auth_failed`. |
| `routes/_authenticated/route.tsx` | pathless layout `_authenticated` | guard | Loader: `getAuth()`; no user throws `redirect({ href: buildSignInPath(location.href) })`. Returns `{ user }` as loader data (read by `/account`). Component is `Outlet`. Every route under `routes/_authenticated/` is behind this guard. |

The login and register pages are a shadcn `Card` (`role="region"` named by the
`<h1>` inside `CardTitle`; `CardHeader`, `CardDescription`, `CardContent`). The
error is a destructive `Alert` with an `AlertDescription`, and the hosted
sign-in/sign-up link is an `<a>` styled with `buttonVariants({ size: "lg" })`.

## Components

| File | Role | shadcn |
| --- | --- | --- |
| `components/auth-provider.tsx` | `AuthProvider` = `AuthKitProvider` > `AuthTokenBridge` > `AuthIdleGuard`. `AuthTokenBridge` installs `useAccessToken().getAccessToken` as the API client's token resolver (`setAccessTokenResolver`); failures resolve to `undefined`. | - |
| `routes/-components/auth-idle-guard.tsx` | `AuthIdleGuard({ timeoutMinutes })`. When a user is signed in, resets a timer on `keydown`, `pointerdown`, `scroll`, `touchstart`; on expiry calls `startServerSignOut("/login")`. Timeout from `VITE_AUTH_IDLE_TIMEOUT_MINUTES` (default 30). | - |
| `components/auth-button.tsx` | Header button. Loading: disabled ghost `Button` "Loading...". Signed out: "Log in" link to `/api/auth/sign-in` styled with `buttonVariants({ size: "sm" })`. Signed in: user email + "Sign out" link to `/logout` styled with `buttonVariants({ size: "sm", variant: "outline" })`. | `Button`, `buttonVariants` |

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

`useAuth().role === "admin"` shows the Admin Dashboard link in the header; the
`/admin/users` loader enforces it (see [admin-users.md](admin-users.md)).
