import { createFileRoute } from "@tanstack/react-router";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";

import { sanitizeReturnTo } from "@/lib/auth-redirect";

export const Route = createFileRoute("/api/auth/sign-in")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const requestedPath = new URL(request.url).searchParams.get(
          "returnPathname"
        );
        const returnPathname = sanitizeReturnTo(requestedPath);

        try {
          const url = await getSignInUrl({ data: { returnPathname } });

          return new Response(null, {
            headers: { Location: url },
            status: 307,
          });
        } catch {
          return Response.redirect(
            new URL("/login?error=auth_unavailable", request.url),
            303
          );
        }
      },
    },
  },
});
