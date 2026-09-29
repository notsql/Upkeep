import { createFileRoute } from "@tanstack/react-router";
import { EstateEditorPage } from "@/routes/_auth/estates/-components/estate-editor-page";

export const Route = createFileRoute("/_auth/estates/new/")({
  component: EstateEditorPage,
  head: () => ({ meta: [{ title: "Create estate" }] }),
});
