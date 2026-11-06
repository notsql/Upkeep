import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useInspectionAccess } from "@/lib/inspections";

export function InspectionRecordAction({
  estateId,
  assetId,
  estateActive,
}: {
  estateId: string;
  assetId: string;
  estateActive: boolean;
}) {
  const access = useInspectionAccess(estateId);
  if (!(access.canCreate && estateActive)) {
    return null;
  }
  return (
    <Link
      className={buttonVariants()}
      params={{ estateId, assetId }}
      to="/estates/$estateId/assets/$assetId/inspections/new"
    >
      <Plus aria-hidden="true" />
      Create inspection record
    </Link>
  );
}
