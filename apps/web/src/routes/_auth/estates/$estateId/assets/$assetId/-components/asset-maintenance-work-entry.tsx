import { Badge } from "@proj/ui/components/badge";
import { Link } from "@tanstack/react-router";
import { CompletionOutcome } from "@/components/work-order-completion";
import type { AssetWorkCompletion } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/use-asset-maintenance-section";

export function AssetMaintenanceWorkEntry({
  canView,
  estateId,
  work,
}: {
  canView: boolean;
  estateId: string;
  work: AssetWorkCompletion;
}) {
  return (
    <>
      <p className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline">Work order</Badge>
        {canView ? (
          <Link
            className="text-primary underline underline-offset-4"
            params={{
              estateId,
              workOrderId: work.workOrderId,
            }}
            to="/estates/$estateId/work-orders/$workOrderId"
          >
            {work.reference}
          </Link>
        ) : (
          work.reference
        )}
      </p>
      <p className="mb-4">Work location: {work.locationPath}</p>
      <CompletionOutcome completion={work.completion} />
    </>
  );
}
