import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { EditRolePage } from "@/routes/_auth/estates/$estateId/roles/$roleId/edit/-components/edit-role-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/roles/$roleId/edit/"
)({
  component: EditRoleRoute,
  head: () => pageHead("Edit role"),
});

function EditRoleRoute() {
  const { estateId, roleId } = Route.useParams();
  return (
    <EditRolePage
      estateId={estateId}
      key={`${estateId}:${roleId}`}
      roleId={roleId}
    />
  );
}
