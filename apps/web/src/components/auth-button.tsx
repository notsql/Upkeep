import { env } from "@proj/env/web";
import { Button } from "@proj/ui/components/button";
import { useAuth } from "@workos-inc/authkit-react";
import { useCallback } from "react";

import { startSignOut } from "../lib/auth-session";

/**
 * Sign in / sign out control. Split from `AuthButton` because `useAuth` must be
 * called unconditionally, and it only has a provider to read when AuthKit is
 * configured - see `auth-provider.tsx`.
 */
function AuthKitButton() {
  const { isLoading, signIn, signOut, user } = useAuth();

  const handleSignIn = useCallback(() => signIn(), [signIn]);
  const handleSignOut = useCallback(
    () => startSignOut(signOut, window.location.origin),
    [signOut]
  );

  if (isLoading) {
    return (
      <Button disabled size="sm" variant="ghost">
        Loading...
      </Button>
    );
  }

  if (!user) {
    return (
      <Button onClick={handleSignIn} size="sm">
        Log in
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">{user.email}</span>
      <Button onClick={handleSignOut} size="sm" variant="outline">
        Sign out
      </Button>
    </div>
  );
}

/**
 * Renders nothing when `VITE_WORKOS_CLIENT_ID` is unset, matching the provider:
 * with no WorkOS tenant configured the app has no sign-in to offer.
 */
export function AuthButton() {
  if (!env.VITE_WORKOS_CLIENT_ID) {
    return null;
  }

  return <AuthKitButton />;
}
