import { useAuth } from "@workos-inc/authkit-react";
import type { ReactNode } from "react";

import { AuthKitLogin } from "@/routes/-components/auth-kit-login";

/**
 * Client-side navigation guard for protected route content. Spring Security is
 * the authorization boundary and independently validates every API request.
 */
export function AuthGuard({
  children,
  returnTo,
}: {
  children: ReactNode;
  returnTo: string;
}) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <p aria-label="Checking authentication" role="status">
        Checking authentication...
      </p>
    );
  }

  if (!user) {
    return <AuthKitLogin returnTo={returnTo} />;
  }

  return children;
}
