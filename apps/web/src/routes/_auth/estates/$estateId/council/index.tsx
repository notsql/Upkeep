import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { CouncilPage } from "@/routes/_auth/estates/$estateId/council/-components/council-page";
export const Route = createFileRoute("/_auth/estates/$estateId/council/")({
  component: CouncilRoute,
  head: () => pageHead("Council members"),
});
function CouncilRoute() {
  const { estateId } = Route.useParams();
  return <CouncilPage estateId={estateId} key={estateId} />;
}
