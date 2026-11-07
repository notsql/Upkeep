import { createFileRoute, redirect } from "@tanstack/react-router";

// Pending invitations now show at the top of /estates. This route stays so
// links already sent (bookmarks, emails, the post-sign-in return path) still land.
export const Route = createFileRoute("/_auth/invitations/")({
  beforeLoad: () => {
    throw redirect({ to: "/estates" });
  },
});
