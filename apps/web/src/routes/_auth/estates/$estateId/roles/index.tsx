import { createFileRoute } from "@tanstack/react-router";
import { EstateRolesPage } from "@/routes/_auth/estates/$estateId/roles/-components/estate-roles-page";

export const Route = createFileRoute("/_auth/estates/$estateId/roles/")({
  component: RolesRoute,
  head: () => ({ meta: [{ title: "Estate roles" }] }),
});

function RolesRoute() {
  const { estateId } = Route.useParams();
  return <EstateRolesPage estateId={estateId} key={estateId} />;
}
