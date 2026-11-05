import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AssetCategoriesLayout } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-layout";

/** Header, summary cards and interval SubNav shared by every interval view. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/asset-categories"
)({ component: AssetCategoriesLayoutRoute });

function AssetCategoriesLayoutRoute() {
  const { estateId } = Route.useParams();
  return (
    <AssetCategoriesLayout estateId={estateId}>
      <Outlet />
    </AssetCategoriesLayout>
  );
}
