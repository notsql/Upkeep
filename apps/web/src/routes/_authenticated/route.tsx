import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";

import { buildSignInPath } from "@/lib/auth-redirect";

export const Route = createFileRoute("/_authenticated")({
  component: Outlet,
  loader: async ({ location }) => {
    const { user } = await getAuth();

    if (!user) {
      throw redirect({ href: buildSignInPath(location.href) });
    }

    return { user };
  },
});
