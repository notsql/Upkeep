import { createFileRoute } from "@tanstack/react-router";
import { SimulatorPage } from "@/routes/-components/simulator-page";

export const Route = createFileRoute("/")({
  component: SimulatorPage,
});
