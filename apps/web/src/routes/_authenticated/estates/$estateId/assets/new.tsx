import { createFileRoute } from "@tanstack/react-router";
import { NewAssetPage } from "@/routes/_authenticated/estates/$estateId/assets/-components/asset-editor-page";

export const Route = createFileRoute(
  "/_authenticated/estates/$estateId/assets/new"
)({
  component: NewAssetRoute,
  head: () => ({ meta: [{ title: "Register asset" }] }),
});

function NewAssetRoute() {
  const { estateId } = Route.useParams();
  return <NewAssetPage estateId={estateId} />;
}
