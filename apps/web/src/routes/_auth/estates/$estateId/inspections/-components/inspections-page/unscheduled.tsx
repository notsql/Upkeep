import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import type { InspectionList } from "@/lib/inspection-list";

/**
 * Assets with regular checks on but no service interval: no check will ever
 * come due for them, so this is a warning with a way to fix it.
 */
export function Unscheduled({
  canManage,
  data,
  estateId,
}: {
  /** Can open Check schedules (MANAGE_INSPECTIONS). */
  canManage: boolean;
  data: InspectionList;
  estateId: string;
}) {
  const headingId = useId();
  const count = data.unscheduled.length;
  if (count === 0) {
    return null;
  }
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h2 className="text-lg font-semibold" id={headingId}>
        Assets without a schedule
      </h2>
      <Alert variant="warning">
        <TriangleAlert aria-hidden="true" />
        <AlertDescription>
          {`${count} ${count === 1 ? "asset has" : "assets have"} regular checks on but no service interval, so no check will come due.`}
        </AlertDescription>
      </Alert>
      <ul className="grid gap-1">
        {data.unscheduled.map((asset) => (
          <li className="flex flex-wrap gap-2" key={asset.assetId}>
            <Link
              className="underline underline-offset-4"
              params={{ estateId, assetId: asset.assetId }}
              to="/estates/$estateId/assets/$assetId"
            >
              {`${asset.assetReference} · ${asset.assetName}`}
            </Link>
            <span className="text-muted-foreground">{asset.categoryLabel}</span>
          </li>
        ))}
      </ul>
      {canManage ? (
        <p>
          <Link
            className="underline underline-offset-4"
            params={{ estateId }}
            to="/estates/$estateId/inspections/schedules"
          >
            Set check schedules
          </Link>
        </p>
      ) : null}
    </section>
  );
}
