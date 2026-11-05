import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { NewReportPage } from "@/routes/_auth/reports/new/-components/new-report-page";

export const Route = createFileRoute("/_auth/reports/new/")({
  validateSearch: (search: Record<string, unknown>): { estateId?: string } => ({
    ...(typeof search.estateId === "string" && search.estateId
      ? { estateId: search.estateId }
      : {}),
  }),
  component: NewReportRoute,
  head: () => pageHead("Report a fault"),
});

function NewReportRoute() {
  const { estateId } = Route.useSearch();
  return (
    <NewReportPage key={estateId ?? "choose"} requestedEstateId={estateId} />
  );
}
