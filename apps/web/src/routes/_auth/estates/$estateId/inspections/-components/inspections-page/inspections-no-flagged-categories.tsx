import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";

export function InspectionsNoFlaggedCategories({
  estateId,
}: {
  estateId: string;
}) {
  return (
    <Alert aria-label="No regular checks" className="gap-3 p-4" role="note">
      <AlertDescription className="text-sm">
        No equipment has regular checks turned on yet, so nothing is due.
      </AlertDescription>
      <Link
        className={buttonVariants({
          className: "justify-self-start",
          size: "sm",
          variant: "outline",
        })}
        params={{ estateId }}
        to="/estates/$estateId/inspections/schedules"
      >
        Turn on regular checks
      </Link>
    </Alert>
  );
}
