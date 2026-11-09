import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CheckSchedulesLayout } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-layout/check-schedules-layout";

/** Header, summary cards and interval SubNav shared by every interval view. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/inspections/schedules"
)({ component: CheckSchedulesLayoutRoute });

function CheckSchedulesLayoutRoute() {
  const { estateId } = Route.useParams();
  return (
    <CheckSchedulesLayout estateId={estateId}>
      <Outlet />
    </CheckSchedulesLayout>
  );
}
