# 0009 - AuthKit sessions live in TanStack Start

## Status

Accepted.

## Context

The generic AuthKit React SDK restored authentication only after the browser
hydrated. That was enough to control client rendering, while Spring still
protected API data, but TanStack Start could not reject an unauthenticated page
request before rendering the application shell.

WorkOS provides an official TanStack Start adapter with request middleware,
PKCE callback handlers, server-side session access, and client hooks.

## Decision

`apps/web` uses `@workos/authkit-tanstack-react-start`. The adapter stores the
WorkOS session in an encrypted HTTP-only cookie and protected route loaders call
`getAuth()` before rendering. Sign-in and sign-up begin at server route handlers
so the adapter can bind the OAuth flow to PKCE state.

The browser continues calling Spring directly. Client hooks obtain a fresh
WorkOS access token and the generated API client sends it as a bearer token;
Spring remains the authoritative API security boundary and validates every JWT.

## Consequences

- The web server requires `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`,
  `WORKOS_REDIRECT_URI`, and a 32-character-or-longer
  `WORKOS_COOKIE_PASSWORD`.
- WorkOS secrets have no `VITE_` prefix and are never included in the browser
  bundle.
- The WorkOS redirect URI points to `/api/auth/callback`, and the Initiate login
  URI points to `/api/auth/sign-in`.
- Route loaders return only user information to the browser, never the access or
  refresh token.
- Logout runs through a server route so session termination, cookie clearing,
  and the final redirect happen in one flow.
- CSRF middleware runs before AuthKit middleware for TanStack server functions.
