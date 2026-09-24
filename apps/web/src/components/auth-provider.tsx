import { env } from "@proj/env/web";
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import type { ComponentProps, ReactNode } from "react";
import { useEffect } from "react";

import { setAccessTokenResolver } from "../lib/api";
import { getCurrentReturnTo, restoreReturnTo } from "../lib/auth-redirect";
import { reauthenticateAfterRefreshFailure } from "../lib/auth-session";
import { AuthIdleGuard } from "../routes/-components/auth-idle-guard";

type ProviderProps = ComponentProps<typeof AuthKitProvider>;

const handleRedirectCallback: NonNullable<
  ProviderProps["onRedirectCallback"]
> = ({ state }) => {
  restoreReturnTo(state?.returnTo);
};

const handleRefreshFailure: NonNullable<ProviderProps["onRefreshFailure"]> = ({
  signIn,
}) => {
  reauthenticateAfterRefreshFailure(signIn, getCurrentReturnTo());
};

/**
 * Hands the API client a way to read the current access token. The client is a
 * module singleton and cannot call hooks, so this bridges the two once AuthKit
 * has mounted. See `lib/api.ts` for why the resolver is browser-only.
 *
 * A failed lookup (not signed in, or the refresh failed) resolves to undefined
 * rather than throwing: the request goes out without a token and the API
 * answers 401, which the caller already has to handle.
 */
function AuthTokenBridge({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();

  useEffect(() => {
    setAccessTokenResolver(() =>
      Promise.resolve(getAccessToken()).catch(() => undefined)
    );
  }, [getAccessToken]);

  return children;
}

/**
 * Wraps the app in WorkOS AuthKit.
 *
 * When `VITE_WORKOS_CLIENT_ID` is unset the provider is skipped entirely and
 * the app runs unauthenticated. That mirrors the server, which leaves the API
 * open until its issuer URI is configured, so a fresh clone runs with no
 * WorkOS tenant and turning auth on stays a config change, not a code change.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const clientId = env.VITE_WORKOS_CLIENT_ID;

  if (!clientId) {
    return children;
  }

  return (
    <AuthKitProvider
      clientId={clientId}
      onRedirectCallback={handleRedirectCallback}
      onRefreshFailure={handleRefreshFailure}
      redirectUri={env.VITE_WORKOS_REDIRECT_URI}
    >
      <AuthTokenBridge>
        <AuthIdleGuard timeoutMinutes={env.VITE_AUTH_IDLE_TIMEOUT_MINUTES}>
          {children}
        </AuthIdleGuard>
      </AuthTokenBridge>
    </AuthKitProvider>
  );
}
