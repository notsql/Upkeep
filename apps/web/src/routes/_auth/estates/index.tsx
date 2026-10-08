import { createFileRoute } from "@tanstack/react-router";
import { EstateListPage } from "@/routes/_auth/estates/-components/estate-list-page";

export const Route = createFileRoute("/_auth/estates/")({
  component: EstateListPage,
  head: () => ({ meta: [{ title: "Estates" }] }),
});
