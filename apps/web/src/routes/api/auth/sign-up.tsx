import { createFileRoute } from "@tanstack/react-router";
import { getSignUpUrl } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/api/auth/sign-up")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = await getSignUpUrl({
            data: { returnPathname: "/account" },
          });

          return new Response(null, {
            headers: { Location: url },
            status: 307,
          });
        } catch {
          return Response.redirect(
            new URL("/register?error=auth_unavailable", request.url),
            303
          );
        }
      },
    },
  },
});
