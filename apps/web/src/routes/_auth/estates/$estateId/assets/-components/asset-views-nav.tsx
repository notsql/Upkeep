import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { SubNav } from "@/components/page/sub-nav";
import { useAssetViewsAccess } from "@/lib/devices";

/**
 * Tabs between the two Assets list views, plus the "All readings" link for
 * owners and Managers (the sidebar has no Readings item). Rendered by each
 * list page rather than an `assets/route.tsx` layout, which would also wrap
 * asset detail and New asset. The tabs show only when the viewer can open
 * both views: one tab alone switches to nothing.
 */
export function AssetViewsNav({ estateId }: { estateId: string }) {
  const access = useAssetViewsAccess(estateId);
  if (access.pending) {
    return null;
  }
  const tabs = access.assetPages && access.allDevices;
  if (!(tabs || access.allReadings)) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      {tabs ? (
        <SubNav
          items={[
            {
              exact: true,
              label: "By location",
              params: { estateId },
              to: "/estates/$estateId/assets",
            },
            {
              label: "All devices",
              params: { estateId },
              to: "/estates/$estateId/assets/devices",
            },
          ]}
          label="Asset views"
        />
      ) : null}
      {access.allReadings ? (
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          params={{ estateId }}
          to="/estates/$estateId/readings"
        >
          <Activity aria-hidden="true" />
          All readings
        </Link>
      ) : null}
    </div>
  );
}
