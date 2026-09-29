import { createFileRoute } from "@tanstack/react-router";
import { EstateListPage } from "@/routes/_authenticated/estates/-components/estate-list-page";

export const Route = createFileRoute("/_authenticated/estates/")({
  component: EstateListPage,
  head: () => ({ meta: [{ title: "My estates" }] }),
});
