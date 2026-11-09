import { SubNav } from "@/components/page/sub-nav";
import { useAssetViewsAccess } from "@/lib/devices";

/**
 * Full-width tabs between the two Assets list views. Rendered by each list
 * page rather than an `assets/route.tsx` layout, which would also wrap asset
 * detail and New asset. The tabs show only when the viewer can open both
 * views: one tab alone switches to nothing.
 */
export function AssetViewsNav({ estateId }: { estateId: string }) {
  const access = useAssetViewsAccess(estateId);
  if (access.pending || !(access.assetPages && access.allDevices)) {
    return null;
  }
  return (
    <SubNav
      items={[
        {
          exact: true,
          label: "By location",
          params: { estateId },
          to: "/estates/$estateId/assets",
        },
        {
          label: "All sensors",
          params: { estateId },
          to: "/estates/$estateId/assets/devices",
        },
      ]}
      label="Asset views"
    />
  );
}
