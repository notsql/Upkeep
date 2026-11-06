import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { NewRolePage } from "@/routes/_auth/estates/$estateId/roles/new/-components/new-role-page/new-role-page";

/** `returnTo=council` comes from the invite dialog's "Create new role…". */
export interface NewRoleSearch {
  returnTo?: "council";
}

export const Route = createFileRoute("/_auth/estates/$estateId/roles/new/")({
  validateSearch: (search: Record<string, unknown>): NewRoleSearch =>
    search.returnTo === "council" ? { returnTo: "council" } : {},
  component: NewRoleRoute,
  head: () => pageHead("New role"),
});

function NewRoleRoute() {
  const { estateId } = Route.useParams();
  const { returnTo } = Route.useSearch();
  return <NewRolePage estateId={estateId} key={estateId} returnTo={returnTo} />;
}
