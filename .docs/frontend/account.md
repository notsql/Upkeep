# Account (frontend)

Paths are relative to `apps/web/src/`.

## Routes

| File | URL | Guard | Title |
| --- | --- | --- | --- |
| `routes/_auth/account/index.tsx` | `/account` | `_auth` (signed in) | "Your account" |

## Screen

`AccountPage` reads the signed-in user from the `_auth` layout's
loader data (`getRouteApi("/_auth").useLoaderData().user`) and shows a
`<dl>` of:

- **Name** - `firstName lastName`, or "Not provided".
- **Email** - `user.email`.

Read-only. No shadcn components.

## Endpoints

None. The data comes from the AuthKit session, not the Spring API. After
sign-up, AuthKit returns users here (`returnPathname: "/account"`).
