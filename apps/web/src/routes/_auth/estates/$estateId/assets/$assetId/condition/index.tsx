import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AssetConditionHistoryPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/condition/-components/asset-condition-history-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/condition/"
)({
  component: ConditionHistoryRoute,
  head: () => pageHead("Condition history"),
});

function ConditionHistoryRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetConditionHistoryPage assetId={assetId} estateId={estateId} />;
}
