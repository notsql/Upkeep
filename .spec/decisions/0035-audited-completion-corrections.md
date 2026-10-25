# 0035 — Audited completion corrections

Agreed 2026-10-24. Supersedes the closed-outcome immutability policy in
[0034](0034-work-order-progress-and-canonical-completion.md); its status,
authorization, cost and canonical-identity decisions otherwise remain in force.

Manual review identified a need to correct mistaken findings, repair notes,
costs and downtime after closure. Reopening would misrepresent the work's status;
creating another maintenance record would duplicate repair/cost counts.

Active estate owners/current Managers may correct the existing completion with
a required reason. The order stays Closed, retaining its completion ID, original
closer/time, saved location and asset relationship. Crew remain readers. Asset
retirement/movement does not prevent corrections; inactive estates stay read-only.

One estate-first transaction checks membership and expectedVersion, updates the
canonical outcome/edit metadata and order version, and appends a revision with
before/after snapshots, reason, actor/time and both versions. Prisma owns the
revision model and additive migration. Snapshots preserve the original outcome
on the first correction without rewriting historical audit events.

Same-version unchanged outcomes are no-ops. A lost-response retry replays only
the latest matching correction by the same actor, from the same original version
and with the same normalized outcome/reason. Other stale writes conflict.
Authorization precedes replay. Corrections never append another Closed transition.

Asset Maintenance displays the current canonical outcome and an Edited marker;
work-order detail exposes before/after revisions. Downstream ID-49/50 consumers
must process corrections as updates under the same identity. Source reports,
asset condition, manual events and forecasts remain unchanged.
