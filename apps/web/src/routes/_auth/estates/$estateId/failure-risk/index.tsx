import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { FailureRiskPage } from "@/routes/_auth/estates/$estateId/failure-risk/-components/failure-risk-page/failure-risk-page";

export const Route = createFileRoute("/_auth/estates/$estateId/failure-risk/")({
  component: FailureRiskRoute,
  head: () => pageHead("Failure risk"),
});

function FailureRiskRoute() {
  const { estateId } = Route.useParams();
  return <FailureRiskPage estateId={estateId} key={estateId} />;
}
