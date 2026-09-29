# Account (frontend)

Paths are relative to `apps/web/src/`.

## Routes

| File | URL | Guard | Title |
| --- | --- | --- | --- |
| `routes/_authenticated/account.tsx` | `/account` | `_authenticated` (signed in) | "Your account" |

## Screen

`AccountPage` reads the signed-in user from the `_authenticated` layout's
loader data (`getRouteApi("/_authenticated").useLoaderData().user`) and shows a
`<dl>` of:

- **Name** - `firstName lastName`, or "Not provided".
- **Email** - `user.email`.

Read-only. No shadcn components.

## Endpoints

None. The data comes from the AuthKit session, not the Spring API. After
sign-up, AuthKit returns users here (`returnPathname: "/account"`).
