import { createFileRoute } from "@tanstack/react-router";
import { FailureRiskPage } from "@/routes/_auth/estates/$estateId/failure-risk/-components/failure-risk-page";

export const Route = createFileRoute("/_auth/estates/$estateId/failure-risk/")({
  component: FailureRiskRoute,
  head: () => ({ meta: [{ title: "Failure risk" }] }),
});

function FailureRiskRoute() {
  const { estateId } = Route.useParams();
  return <FailureRiskPage estateId={estateId} key={estateId} />;
}
