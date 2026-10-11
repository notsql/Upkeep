import { createFileRoute } from "@tanstack/react-router";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";

import { sanitizeReturnTo } from "@/lib/auth-redirect";

export const Route = createFileRoute("/api/auth/sign-in/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const search = new URL(request.url).searchParams;
        const invitationToken = search.get("invitation_token");
        const returnPathname = invitationToken
          ? "/estates"
          : sanitizeReturnTo(search.get("returnPathname"));

        try {
          const url = new URL(await getSignInUrl({ data: { returnPathname } }));
          // The installed AuthKit wrapper creates PKCE state but does not expose
          // this supported authorization parameter in its options.
          if (invitationToken) {
            url.searchParams.set("invitation_token", invitationToken);
          }

          return new Response(null, {
            headers: { Location: url.toString() },
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
