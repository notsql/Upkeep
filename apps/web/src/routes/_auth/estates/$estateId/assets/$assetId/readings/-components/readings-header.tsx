import { Activity } from "lucide-react";
import { CreateButton } from "@/components/page-actions";
import { PageHeader } from "@/components/page-header";
import type { ReadingFilters } from "@/lib/readings";

export function ReadingsHeader({
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
  metric: ReadingFilters["metric"];
}) {
  return (
    <PageHeader
      actions={
        canRecord ? (
          <CreateButton
            params={{ estateId }}
            search={{ assetId, metric }}
            to="/estates/$estateId/readings/new"
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
      description="Sensor readings, newest first"
      icon={Activity}
      title="Readings"
    />
  );
}
