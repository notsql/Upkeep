# Resident reporting screens

Resident and estate responder list/detail screens share presentation in
`apps/web/src/components/reports/`: `report-card.tsx` renders the shadcn card
and heading; `report-metadata.tsx` renders labelled estate, location, status
and submission time; `report-details.tsx` renders the labelled Description and
Images sections; `report-image.tsx` renders private image blobs and owns object
URL creation/cleanup. The resident routes supply their own links and image
query wrappers; the detail image wrapper lives in
`reports/$reportId/-components/private-report-image.tsx`. The shared components
derive report types from the generated
contract and do not fetch data or decide access. Resident images retain their
existing empty loading presentation. Responder details additionally supply a
location action and opt into the Updated timestamp.

All routes nest under `apps/web/src/routes/_auth/reports/`. The `_auth` `beforeLoad` authenticates report routes without requiring current membership. Management routes await a request-scoped access lookup before any child loader starts. A resident-only account lands on `/reports/new`; mixed accounts retain permitted management deep links in their other estates, while denied work-order/document deep links retain Page not found. User-initiated estate switching to a Resident estate opens its scoped My reports. Unassigned accounts see the missing-assignment explanation. My reports navigation is visible only with a current Resident membership, including mixed-role accounts, and is hidden for management-only, platform-admin-only and former-resident accounts on desktop and mobile. Direct history/detail access retains existing authenticated ownership checks. Opening a report from scoped history preserves estateId in its URL and its Return to My Reports link.

`lib/access-server.ts` uses AuthKit's session token with a fresh generated API client for each server request, returning profile/access data without tokens. `lib/access.ts` owns `GET /access/context` with key `[userId, "app-access"]`, mounted identity gating and focus refetch. Navigation waits for this projection; mixed accounts see both reporting and management destinations. Target-estate capabilities govern Assets/Estate members links. JWT resident role claims do not control any reporting UI. Identity changes cancel and remove the previous user's access, report and estate queries; image components revoke their blob URLs.

| Route folder | Screen and shadcn components | API calls |
| --- | --- | --- |
| `reports/new/index.tsx` → `/reports/new` | Assigned estate label or Estate Select; block, level and optional common-area `Select`; Title `Input`, Description `Textarea`, file `Input`, `Label`, `Button`, `Card`, `Alert`. Requires a nonblank trimmed title of up to 50 characters, description and block plus level/common area. Selected photos can be removed. Preserves title and other input on submit errors and opens detail on success. | `GET /resident/context`, `GET /resident/locations`, `POST /resident/reports` |
| `reports/index.tsx` → `/reports` or `/reports?estateId=...`; `-components/my-reports-page.tsx` owns the screen | Own-report `Card`s linked by their saved titles, with labelled Estate name, Location, Status and Submission time in a description list. Location and status `Badge` share a vertically aligned flex row that wraps on narrow screens. Includes selected estate name, scoped empty/error/loading states and cursor controls. | `GET /resident/reports` with optional estateId/cursor |
| `reports/$reportId/index.tsx` → `/reports/{reportId}` | Matches the history card heading and labelled metadata, including the aligned location/status row. Labelled Description and Images sections display complete multiline text with long-word wrapping and every private image at full available width with its natural aspect ratio and automatic height. No image height cap or cropping. Empty images show No images submitted; image failures remain visible. Uses `Card`/`Badge`; missing/forbidden reports show a generic unavailable alert. | `GET /resident/reports/{reportId}`, `GET /resident/reports/{reportId}/images/{imageId}` |

`apps/web/src/lib/reports.ts` owns all generated-client React Query hooks. Per-user query keys start with the current user ID: `[userId, "resident-context"]`, `[userId, "resident-locations", estateId]`, `[userId, "reports", "list", estateId, cursor]`, `[userId, "reports", reportId]`, `[userId, "reports", reportId, "image", imageId]`. Queries are enabled only after mounting with a resolved authenticated identity. Server membership checks control location/submission access; history stays readable by its owner after membership deletion, while its navigation link is hidden. Submission has no automatic retry and invalidates that user's report lists. Detail refetches on window focus. The image hook requests a blob with the authenticated API client; the component creates a local object URL and revokes it when the image or identity changes.

`reports/new/index.tsx` defines the route and page title. Its `-components/` folder contains `new-report-page.tsx` for resident context loading/error states, `new-report-form.tsx` for estate selection, estate-specific location loading/error states, form state, validation, image limits, submission and navigation, `resident-estate-selector.tsx` for the multi-estate selector, and `report-location-fields.tsx`, `report-details-fields.tsx` and `report-images-field.tsx` for the labelled form sections and removable selected images.

The new-report screen has one labelled shadcn file `Input` with `accept="image/*"`, `multiple`, and no `capture` attribute. It opens the device's native image chooser; supported mobile browsers offer both existing photos and camera capture there. The application does not force a camera or guarantee a camera option on every browser. Repeated selections accumulate in the same removable list, up to three images. Helper text states the server's JPEG/PNG and 5 MB limits; the broader chooser hint does not change server validation.

The generated request schema describes multipart binary fields as strings, so the hook passes a `FormData` body to `openapi-fetch`, which handles it at runtime. The image response is parsed as a blob. No raw fetch is used.

The create mutation derives its input fields from the generated `CreateIssueReportRequest`, replacing only `images` with browser `File[]`. It sends `estateId`, `title`, `description`, `locationId` and optional repeated `images` in FormData. The form shows the title length limit and preserves entered text after a server rejection. Title and description render as plain React text in history/detail.


## Multi-estate invitation support (2026-10-18)

ResidentContextResponse now contains estates[] and canSubmit. The new-report
screen uses the sole active assignment automatically, or presents a labelled
shadcn Estate Select when several exist. Only RESIDENT assignments appear.
Changing estate clears block/level/common-area selections and fetches the chosen
estate's locations. A submission includes explicit estateId; the server rechecks
membership/location within the write transaction. Account migration is deferred.

useResidentLocations(estateId) calls GET /resident/locations with estateId and
uses the key [userId, resident-locations, estateId], enabled only after selection.
useCreateReport sends estateId in multipart data. Other report/history/image
hooks retain their endpoints and user-scoped keys. Acceptance/role/removal hooks
refresh access and resident contexts. [Staff location correction](estate-reports.md)
uses estate-scoped report routes; personal history retains ownership checks.
Corrected placement appears on subsequent reads/focus refresh; a successful
correction in the same browser also invalidates current-user personal reports.

## Estate context preselection

reports/new/index.tsx validates optional URL estateId (nonempty string).
NewReportRoute passes it to NewReportPage and keys the page by the selection,
resetting form state on a context switch. NewReportPage verifies the ID against
GET /resident/context's active assignments before mounting NewReportForm; an
unavailable/foreign selection explains that reporting is unavailable and never
silently chooses another estate. The form initializes that authorized estate,
then uses the existing per-estate location query. Changing the form's Estate
Select also updates URL estateId so the shell context stays synchronized. No API
or mutation changes.
The shell estate dropdown includes all membership roles, even a sole Resident
estate. The selected estate/role stay within the sidebar with truncated text and full accessible names/descriptions. The opened menu wraps full names within viewport bounds. Resident entries label their destination as My reports during browsing or Report a fault during explicit creation; unavailable reporting only disables creation, while owned history remains readable.


## Browsing and explicit report creation (2026-10-26)

The shared shell switcher sends Resident selections from Crew work orders,
Documents or other browsing screens to `/reports?estateId=...`. It keeps
`/reports/new?estateId=...` when the user is already creating a report. Current
feature destinations remain in use when the selected estate permits them.
Resident navigation and the history header's Report a fault action preserve the
selected estate. Global history without estate context still lists all owned reports.

The history route validates optional nonempty estateId and resolves its display
name from current app access. `-components/my-reports-page.tsx` uses shadcn Cards,
Alert/Button and shared report presentation. Its inner pagination state remounts
for user/estate changes, clearing prior cursor/back-page state. `useReportList`
passes estateId to the generated API client; filtering happens on the server,
not on a single loaded page. Submission and staff correction invalidations retain
the `[userId, "reports", "list"]` prefix and therefore refresh every estate scope.

The report detail route also validates optional estateId solely for navigation;
its GET remains protected by report ownership. Scoped list links and the return
link preserve the selection. Failed reads retain their existing error UI. No
resident permissions or database schema changed with this navigation improvement.
