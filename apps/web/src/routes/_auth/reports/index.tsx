import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { MyReportsPage } from "./-components/my-reports-page";

export const Route = createFileRoute("/_auth/reports/")({
  validateSearch: (search: Record<string, unknown>): { estateId?: string } => ({
    ...(typeof search.estateId === "string" && search.estateId
      ? { estateId: search.estateId }
      : {}),
  }),
  component: MyReportsRoute,
  head: () => pageHead("My reports"),
});
function MyReportsRoute() {
  const { estateId } = Route.useSearch();
  return <MyReportsPage estateId={estateId} />;
}
