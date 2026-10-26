import { createFileRoute } from "@tanstack/react-router";
import { useAppAccess } from "@/lib/access";
import { MyReportsPage } from "./-components/my-reports-page";

export const Route = createFileRoute("/_auth/reports/")({
  validateSearch: (search: Record<string, unknown>): { estateId?: string } => ({
    ...(typeof search.estateId === "string" && search.estateId
      ? { estateId: search.estateId }
      : {}),
  }),
  component: MyReportsRoute,
  head: () => ({ meta: [{ title: "My reports" }] }),
});
function MyReportsRoute() {
  const { estateId } = Route.useSearch();
  const access = useAppAccess();
  const estateName = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  )?.estateName;
  return <MyReportsPage estateId={estateId} estateName={estateName} />;
}
