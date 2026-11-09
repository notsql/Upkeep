import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import {
  CheckSchedulesList,
  intervalFilterFor,
} from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/check-schedules-page";

/** One service-interval view: days, months, years or not-set. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/inspections/schedules/$interval/"
)({
  beforeLoad: ({ params }) => {
    const filter = intervalFilterFor(params.interval);
    if (!filter) {
      throw notFound();
    }
    return { filter };
  },
  component: CheckSchedulesIntervalRoute,
  head: () => pageHead("Check schedules"),
});

function CheckSchedulesIntervalRoute() {
  const { estateId } = Route.useParams();
  const { filter } = Route.useRouteContext();
  return <CheckSchedulesList estateId={estateId} filter={filter} />;
}
