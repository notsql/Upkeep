# 0029 - Estate-scoped fault report responders

Date: 2026-10-18. Related: 0026 resident-report access/storage, 0027 estate
resident authority and 0028 estate roles.

Managers and Crew need to read an estate's reports and correct location while
resident history remains private to its submitter.

Use separate `/estates/{estateId}/reports` endpoints authorized by current
MANAGER/CREW membership. WorkOS authenticates identity and does not grant report
authority. Council, Member and Resident memberships do not grant responder
access; ownership alone is not a responder role. Supporting location reads may
include inactive nodes without expanding Crew's management/write permissions.

Relocation locks the estate before membership, rechecks active estate and
destination ancestry, and compares the editor's expected location. This shares
the hierarchy/membership write boundary and prevents stale corrections or writes
after revocation. Preserve every report field and image except location and
updated timestamp. There is no cross-estate transfer, reason or audit timeline.

Historical paths resolve from current location nodes, including inactive ones.
Subtree filtering executes in PostgreSQL before cursor pagination. Resident
endpoints retain submitter-only reads, including after membership removal.

Crew-only entry redirects Home to assigned reports. Access context supplies
estate names and report capabilities for their estate selector, so navigation
does not require management estate reads. Report pages use this selector for
Manager/Crew memberships together; other management pages retain the existing
management estate switcher. A global Respond to faults destination provides
mixed-role entry when the current estate has no report capability.
