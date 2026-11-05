import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";

export function InspectionsNoFlaggedCategories({
  estateId,
}: {
  estateId: string;
}) {
  return (
    <Alert aria-label="No flagged categories" className="gap-3 p-4" role="note">
      <AlertDescription className="text-sm">
        No asset categories are flagged as failing silently, so no checks can be
        due.
      </AlertDescription>
      <Link
        className={buttonVariants({
          className: "justify-self-start",
          size: "sm",
          variant: "outline",
        })}
        params={{ estateId }}
        to="/estates/$estateId/asset-categories"
      >
        Flag categories
      </Link>
    </Alert>
  );
}
