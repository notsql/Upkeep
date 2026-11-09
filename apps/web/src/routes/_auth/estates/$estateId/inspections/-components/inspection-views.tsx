import { SubNav } from "@/components/page/sub-nav";

/** Tabs shared by Due checks (`/inspections`) and Check schedules. */
export function InspectionViews({ estateId }: { estateId: string }) {
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
