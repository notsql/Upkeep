import { Badge } from "@proj/ui/components/badge";
import { History } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { SubNav } from "@/components/page/sub-nav";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { type HistoryDateFilters, useAssetHistory } from "@/lib/asset-history";

export function HistoryAssetFrame({
  estateId,
  assetId,
  children,
  filters,
}: {
  estateId: string;
  assetId: string;
  children: ReactNode;
  filters: HistoryDateFilters;
}) {
  const history = useAssetHistory(estateId, assetId, filters);
  const asset = history.data?.pages[0]?.asset;
  const retry = useCallback(() => {
    history.refetch();
  }, [history.refetch]);
  return (
    <PageLayout>
      {history.isPending ? (
        <LoadingState label="Loading asset…" rows={2} />
      ) : null}
      {history.error && !asset ? (
        <ErrorState message={history.error.message} onRetry={retry} />
      ) : null}
      {asset ? (
        <>
          <DetailPageHeader
            breadcrumbs={[
              {
                label: "Assets",
                to: "/estates/$estateId/assets",
                params: { estateId },
              },
              { label: asset.reference },
            ]}
            icon={History}
            meta={`${asset.reference} · ${asset.category} · ${asset.locationPath}`}
            status={
              <Badge variant="secondary">
                {asset.status === "RETIRED" ? "Out of use" : "Active"}
              </Badge>
            }
            title={asset.name}
          />
          {asset.installedOn ? (
            <p className="text-muted-foreground text-sm">
              Installed on {asset.installedOn}
            </p>
          ) : null}
          <SubNav
            items={[
              {
                label: "History",
                to: "/estates/$estateId/assets/$assetId/history",
                params: { estateId, assetId },
              },
            ]}
            label="Asset sections"
          />
          {children}
        </>
      ) : null}
    </PageLayout>
  );
}
