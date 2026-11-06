import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { NewAssetPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-editor-page";

export const Route = createFileRoute("/_auth/estates/$estateId/assets/new/")({
  component: NewAssetRoute,
  head: () => pageHead("Register asset"),
});

function NewAssetRoute() {
  const { estateId } = Route.useParams();
  return <NewAssetPage estateId={estateId} />;
}
