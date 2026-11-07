import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { ReadingImportsPage } from "@/routes/_auth/estates/$estateId/readings/imports/-components/reading-imports-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/readings/imports/"
)({ component: ImportRoute, head: () => pageHead("Import CSV") });
function ImportRoute() {
  const { estateId } = Route.useParams();
  return <ReadingImportsPage estateId={estateId} />;
}
