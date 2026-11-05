import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { CouncilPage } from "@/routes/_auth/estates/$estateId/council/-components/council-page/council-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/council/invitations/"
)({
  component: CouncilInvitationsRoute,
  head: () => pageHead("Pending invitations"),
});

function CouncilInvitationsRoute() {
  const { estateId } = Route.useParams();
  return <CouncilPage estateId={estateId} key={estateId} view="invitations" />;
}
