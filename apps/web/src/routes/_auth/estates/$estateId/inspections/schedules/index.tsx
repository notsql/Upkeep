import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { CheckSchedulesList } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/check-schedules-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/inspections/schedules/"
)({
  component: CheckSchedulesRoute,
  head: () => pageHead("Check schedules"),
});

function CheckSchedulesRoute() {
  const { estateId } = Route.useParams();
  return <CheckSchedulesList estateId={estateId} filter="ALL" />;
}
