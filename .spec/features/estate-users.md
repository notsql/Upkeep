# Estate users

**Status:** built
**Owner:** ID-56

## Problem

Estates are visible only to the user who created them. Staff who look after an
estate they did not create cannot see it, and admins have no way to match
access to who is actually responsible for an estate.

## Behaviour

- An admin can grant a user access to an estate, and revoke it.
- Granting access that already exists, or revoking access that does not, succeeds without change.
- Granting access to an estate that does not exist returns 404.
- Only callers with the `admin` role can list, grant or revoke access.
- For a chosen user, the admin sees every estate with whether that user owns it or has been granted access.
- A user's estate list contains the estates they own and the estates they have been granted, with the same status filter.
- Each estate in a response says whether the caller owns it.
- A user with granted access can read the estate's details.
- A user with granted access cannot edit or deactivate the estate (403). Owners keep both.
- Estates the caller neither owns nor has been granted still return 404.
- Grants and revocations apply on the user's next request. Access is read from the database on every request, never from token claims, so the user does not need to be recreated or sign in again.
- The estate list and details pages mark granted estates as shared with you, and hide Edit and Deactivate on them.
- A signed-in user with active estates can switch between them from a header select. The page navigates to the chosen estate and the browser remembers the choice.

## Data

New Prisma model `EstateUser` (a user an admin has assigned to an estate): composite key of `estateId` (FK to `Estate`,
restrict on delete) and WorkOS `userId`, plus `createdAt`. An index on `userId`
backs the per-user list query. Ownership stays on `Estate.ownerUserId`, as
decision 0010 describes, and decision 0012 explains the split.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /api/admin/users/{userId}/estates | - | EstateUserResponse[] | Admin |
| PUT | /api/admin/users/{userId}/estates/{estateId} | - | 204 | Admin |
| DELETE | /api/admin/users/{userId}/estates/{estateId} | - | 204 | Admin |
| GET | /estates, /estates/{id} | unchanged | EstateResponse gains `owned` | Owner or granted |
| PATCH | /estates/{id}, POST /estates/{id}/deactivate | unchanged | 403 for granted users | Owner |

## Edge cases

- Granting access to the estate's owner is stored but changes nothing. The admin view shows owners as such.
- Inactive estates can be granted and revoked. Granted users see them under the Inactive and All filters, the same way owners do.
- Revoking access while the user has the estate open makes their next request return 404.
- The switcher lists only active estates. A remembered estate that is no longer accessible is ignored.
- The user ID is not checked against WorkOS. The admin UI only offers real organisation members, and a grant to an unknown ID gives no one access.

## Out of scope

- Editing and deactivation rights for granted users (view only for now).
- Per-estate roles, invitations, ownership transfer.
- Mapping WorkOS organisations to estates.
- Using the switcher's selection to scope future asset and report pages.
