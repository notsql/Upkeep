import { createFileRoute } from "@tanstack/react-router";
import { EstateEditorPage } from "@/components/estates/estate-editor-page";

export const Route = createFileRoute("/_authenticated/estates/$estateId/edit")({
  component: EstateEditRoute,
  head: () => ({ meta: [{ title: "Edit estate" }] }),
});

function EstateEditRoute() {
  const { estateId } = Route.useParams();
  return <EstateEditorPage estateId={estateId} />;
}
