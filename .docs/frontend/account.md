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

Read-only. Uses shared `PageHeader` (no breadcrumbs, `icon={UserRound}`, description "Profile and sign-in identity") and the
`DetailCard` summary surface. No edits or API calls are introduced.

Entry: "Account settings" in the circular top-right account menu (the only
entry; there is no sidebar on `/account`). It opens
this existing read-only profile screen; it does not introduce editable settings.

## Endpoints

None. The data comes from the AuthKit session, not the Spring API. After
sign-up, AuthKit returns users here (`returnPathname: "/account"`).
