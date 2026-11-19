import { SubNav } from "@/components/page/sub-nav";

/**
 * Tabs shared by Due checks (`/inspections`) and Check schedules. Hidden from
 * viewers who cannot open Check schedules: one tab alone switches to nothing.
 */
export function InspectionViews({
  estateId,
  schedules,
}: {
  estateId: string;
  schedules: boolean;
}) {
  if (!schedules) {
    return null;
  }
  return (
    <SubNav
      items={[
        {
          exact: true,
          label: "Due checks",
          params: { estateId },
          to: "/estates/$estateId/inspections",
        },
        {
          label: "Check schedules",
          params: { estateId },
          to: "/estates/$estateId/inspections/schedules",
        },
      ]}
      label="Inspection views"
    />
  );
}
