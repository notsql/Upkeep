import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { EstateEditorPage } from "@/routes/_auth/estates/-components/estate-editor-page/estate-editor-page";

export const Route = createFileRoute("/_auth/estates/$estateId/edit/")({
  component: EstateEditRoute,
  head: () => pageHead("Estate settings"),
});

function EstateEditRoute() {
  const { estateId } = Route.useParams();
  return <EstateEditorPage estateId={estateId} />;
}
