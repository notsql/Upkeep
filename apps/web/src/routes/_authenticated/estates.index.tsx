import { createFileRoute } from "@tanstack/react-router";
import { EstateListPage } from "@/components/estates/estate-list-page";

export const Route = createFileRoute("/_authenticated/estates/")({
  component: EstateListPage,
  head: () => ({ meta: [{ title: "My estates" }] }),
});
