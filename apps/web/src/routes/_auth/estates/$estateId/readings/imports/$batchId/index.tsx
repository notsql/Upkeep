import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { ReadingImportBatchPage } from "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/reading-import-batch-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/readings/imports/$batchId/"
)({ component: BatchRoute, head: () => pageHead("Import batch") });
function BatchRoute() {
  const { estateId, batchId } = Route.useParams();
  return <ReadingImportBatchPage batchId={batchId} estateId={estateId} />;
}
