import { Activity } from "lucide-react";
import { CreateButton } from "@/components/page/page-actions";
import { PageHeader } from "@/components/page/page-header";
import {
  manualReadingLocation,
  type ReadingSearch,
} from "@/lib/reading-filters";

export function AssetReadingsHeader({
  assetId,
  assetName,
  canRecord,
  estateId,
  metric,
}: {
  assetId: string;
  assetName: string | undefined;
  canRecord: boolean | undefined;
  estateId: string;
  metric: ReadingSearch["metric"];
}) {
  return (
    <PageHeader
      actions={
        canRecord ? (
          <CreateButton
            {...manualReadingLocation(estateId, { assetId, metric })}
          />
        ) : undefined
      }
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
