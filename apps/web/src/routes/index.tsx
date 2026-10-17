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
  },
  head: () => ({ meta: [{ title: "UpKeep — Estate workspace" }] }),
});
