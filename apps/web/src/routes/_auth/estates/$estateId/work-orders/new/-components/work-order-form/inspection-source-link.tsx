import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { InspectionResult } from "@/lib/inspections";

export function InspectionSourceLink({ record }: { record: InspectionResult }) {
  return (
    <Link
      className={buttonVariants({ variant: "outline", size: "sm" })}
      params={{
        estateId: record.estateId,
        assetId: record.assetId,
        inspectionId: record.id,
      }}
      to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
    >
      View inspection
    </Link>
  );
}
