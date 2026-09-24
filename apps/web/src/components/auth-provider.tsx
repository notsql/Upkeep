import { env } from "@proj/env/web";
import {
  AuthKitProvider,
  useAccessToken,
} from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { setAccessTokenResolver } from "@/lib/api";
import { AuthIdleGuard } from "@/routes/-components/auth-idle-guard";

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
  const { getAccessToken } = useAccessToken();

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
 * The TanStack Start adapter stores the WorkOS session in an encrypted,
 * HTTP-only cookie. Client hooks call its server functions and never receive
 * the refresh token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <AuthTokenBridge>
        <AuthIdleGuard timeoutMinutes={env.VITE_AUTH_IDLE_TIMEOUT_MINUTES}>
          {children}
        </AuthIdleGuard>
      </AuthTokenBridge>
    </AuthKitProvider>
  );
}
