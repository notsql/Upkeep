import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionAccess } from "@/lib/access-server";
import { HomePage } from "@/routes/-components/home-page";
export const Route = createFileRoute("/")({
  component: HomePage,
  beforeLoad: async ({ context }) => {
    const { user, access } = await getSessionAccess();
    if (user && access) {
      context.queryClient.setQueryData([user.id, "app-access"], access);
    }
    if (user && access?.hasResidentMembership && !access.canEnterWorkspace) {
      throw redirect({ href: "/reports/new" });
    }
    const reportEstate = access?.estates.find(
      (estate) => estate.canViewFaultReports
    );
    if (
      user &&
      reportEstate &&
      !access?.estates.some((estate) => estate.canViewManagement)
    ) {
      throw redirect({ href: `/estates/${reportEstate.estateId}/reports` });
    }
    if (
      user &&
      access &&
      !reportEstate &&
      !access.estates.some((estate) => estate.canViewManagement)
    ) {
      const scoped = access.estates.find(
        (estate) => estate.canViewEstateRoles || estate.canViewEstateInvitations
      );
      if (scoped) {
        throw redirect({
          href: `/estates/${scoped.estateId}/${scoped.canViewEstateRoles ? "roles" : "council"}`,
        });
      }
    }
  },
  head: () => ({ meta: [{ title: "UpKeep — Estate workspace" }] }),
});
