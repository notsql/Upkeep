import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { InspectionCheck } from "@/lib/inspection-list";

export function CheckAction({
  check,
  estateId,
  canRecord,
}: {
  check: InspectionCheck;
  estateId: string;
  canRecord: boolean;
}) {
  if (check.result) {
    return (
      <Link
        className={buttonVariants({ size: "sm", variant: "ghost" })}
        params={{
          estateId,
          assetId: check.assetId,
          inspectionId: check.result.id,
        }}
        to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
      >
        View result
      </Link>
    );
  }
  if (!canRecord) {
    return null;
  }
  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "ghost" })}
      params={{ estateId, assetId: check.assetId }}
      to="/estates/$estateId/assets/$assetId/inspections/new"
    >
      Record inspection
    </Link>
  );
}
