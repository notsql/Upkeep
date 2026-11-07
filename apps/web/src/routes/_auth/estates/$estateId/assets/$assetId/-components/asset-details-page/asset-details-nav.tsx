import { SubNav } from "@/components/page/sub-nav";

export function AssetDetailsNav({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const params = { estateId, assetId };
  return (
    <SubNav
      items={[
        {
          label: "History",
          params,
          to: "/estates/$estateId/assets/$assetId/history",
        },
        {
          exact: true,
          label: "Overview",
          params,
          to: "/estates/$estateId/assets/$assetId",
        },
        {
          label: "Maintenance",
          params,
          to: "/estates/$estateId/assets/$assetId/maintenance",
        },
        {
          label: "Inspections",
          params,
          to: "/estates/$estateId/assets/$assetId/inspections",
        },
        {
          label: "Documents",
          params,
          to: "/estates/$estateId/assets/$assetId/documents",
        },
        {
          label: "Costs",
          params,
          to: "/estates/$estateId/assets/$assetId/costs",
        },
        {
          label: "Devices",
          params,
          to: "/estates/$estateId/assets/$assetId/devices",
        },
      ]}
      label="Asset sections"
    />
  );
}
