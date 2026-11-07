import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { EstateRolesPage } from "@/routes/_auth/estates/$estateId/roles/-components/estate-roles-page/estate-roles-page";

export const Route = createFileRoute("/_auth/estates/$estateId/roles/")({
  component: RolesRoute,
  head: () => pageHead("Estate roles"),
});

function RolesRoute() {
  const { estateId } = Route.useParams();
  return <EstateRolesPage estateId={estateId} key={estateId} />;
}
