import { Gauge } from "lucide-react";
import type { ReactNode } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { SubNav } from "@/components/page/sub-nav";

/** The frame shared by both device metric views: header, note and SubNav. */
export function SensorsLayout({
  estateId,
  children,
}: {
  estateId: string;
  children: ReactNode;
}) {
  return (
    <PageLayout className="min-w-0">
      <ListPageHeader
        description="Flatline review, policies and pauses"
        icon={Gauge}
        title="Device monitoring"
      />
      <p className="text-muted-foreground mb-5 text-sm">
        A possible flatline means a device kept sending nearly unchanged values.
        It needs review; it does not prove the device or asset is faulty.
        Silence does not count as unchanged readings.
      </p>
      <SubNav
        items={[
          {
            exact: true,
            label: "Needs review",
            params: { estateId },
            to: "/estates/$estateId/sensors",
          },
          {
            label: "All device metrics",
            params: { estateId },
            to: "/estates/$estateId/sensors/all",
          },
        ]}
        label="Device metric views"
      />
      {children}
    </PageLayout>
  );
}
