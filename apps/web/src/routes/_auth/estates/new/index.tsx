import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { EstateEditorPage } from "@/routes/_auth/estates/-components/estate-editor-page/estate-editor-page";

export const Route = createFileRoute("/_auth/estates/new/")({
  component: EstateEditorPage,
  head: () => pageHead("Create estate"),
});
