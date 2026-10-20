import { createFileRoute } from "@tanstack/react-router";
import { NewReportPage } from "@/routes/_auth/reports/new/-components/new-report-page";

export const Route = createFileRoute("/_auth/reports/new/")({
  component: NewReportPage,
  head: () => ({ meta: [{ title: "Report a fault" }] }),
});
