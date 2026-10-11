import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/routes/-components/home-page";
export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({ meta: [{ title: "UpKeep — Estate workspace" }] }),
});
