import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { LoadingState } from "@/components/loading-state";
export function WorkOrderLocationFeedback({
  estateId,
  pending,
  failed,
  locations,
  expectedSourceLocationId,
  onRetry,
}: {
  estateId: string;
  pending: boolean;
  failed: boolean;
  locations: { id: string }[];
  expectedSourceLocationId: string | undefined;
  onRetry: () => unknown;
}) {
  if (pending) {
    return <LoadingState label="Loading locations…" rows={2} />;
  }
  if (failed) {
    return (
      <p role="alert">
        Unable to load locations.{" "}
        <Button onClick={onRetry} type="button" variant="outline">
          Retry locations
        </Button>
      </p>
    );
  }
  if (locations.length === 0) {
    return (
      <p>
        Add an active location before creating a work order.{" "}
        <Link params={{ estateId }} to="/estates/$estateId">
          Manage locations
        </Link>
      </p>
    );
  }
  if (
    expectedSourceLocationId &&
    !locations.some((location) => location.id === expectedSourceLocationId)
  ) {
    return (
      <p>
        The report location is inactive. Choose an active location for this work
        order.
      </p>
    );
  }
  return null;
}
