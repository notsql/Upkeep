import { Activity } from "lucide-react";
import { PageHeader } from "@/components/page/page-header";

export function AssetReadingsHeader({
  assetId,
  assetName,
  estateId,
}: {
  assetId: string;
  assetName: string | undefined;
  estateId: string;
}) {
  return (
    <PageHeader
      breadcrumbs={[
        {
          label: "Assets",
          to: "/estates/$estateId/assets",
          params: { estateId },
        },
        {
          label: assetName ?? "Asset",
          to: "/estates/$estateId/assets/$assetId",
          params: { estateId, assetId },
        },
        { label: "Readings" },
      ]}
      description="Sensor and manual readings, newest first"
      icon={Activity}
      title="Readings"
    />
  );
}
