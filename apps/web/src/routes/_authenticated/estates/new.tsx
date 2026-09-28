import { createFileRoute } from "@tanstack/react-router";
import { EstateEditorPage } from "@/components/estates/estate-editor-page";

export const Route = createFileRoute("/_authenticated/estates/new")({
  component: EstateEditorPage,
  head: () => ({ meta: [{ title: "Create estate" }] }),
});
