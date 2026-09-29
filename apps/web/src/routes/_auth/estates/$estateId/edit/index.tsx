import { createFileRoute } from "@tanstack/react-router";
import { EstateEditorPage } from "@/routes/_auth/estates/-components/estate-editor-page";

export const Route = createFileRoute("/_auth/estates/$estateId/edit/")({
  component: EstateEditRoute,
  head: () => ({ meta: [{ title: "Edit estate" }] }),
});

function EstateEditRoute() {
  const { estateId } = Route.useParams();
  return <EstateEditorPage estateId={estateId} />;
}
