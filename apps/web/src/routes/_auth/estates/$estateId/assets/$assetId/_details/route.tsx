import {
  createFileRoute,
  Navigate,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { LoadingState } from "@/components/states/loading-state";
import { useInspectionAccess } from "@/lib/inspections";
import { AssetDetailsLayout } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-details-page";
import { InspectionAssetPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-asset-page";

/** Shared header and section SubNav for the asset's sub-pages. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details"
)({
  component: AssetDetailsRoute,
});

function AssetDetailsRoute() {
  const { estateId, assetId } = Route.useParams();
  const access = useInspectionAccess(estateId);
  const pathname = useLocation({ select: (location) => location.pathname });
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canViewAssets) {
    if (access.canViewAssetHistory) {
      const root = `/estates/${estateId}/assets/${assetId}`;
      if (pathname === root || pathname === `${root}/`) {
        return (
          <Navigate
            params={{ estateId, assetId }}
            replace
            to="/estates/$estateId/assets/$assetId/history"
          />
        );
      }
      if (pathname === `${root}/history` || pathname === `${root}/history/`) {
        return <Outlet />;
      }
      return <p role="alert">You do not have access to this asset section.</p>;
    }
    return <InspectionAssetPage assetId={assetId} estateId={estateId} />;
  }
  return (
    <AssetDetailsLayout assetId={assetId} estateId={estateId}>
      <Outlet />
    </AssetDetailsLayout>
  );
}
