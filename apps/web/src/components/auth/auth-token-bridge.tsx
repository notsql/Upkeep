import { useAccessToken } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { setAccessTokenResolver } from "@/lib/api";

/**
 * Hands the API client a way to read the current access token. The client is a
 * module singleton and cannot call hooks, so this bridges the two once AuthKit
 * has mounted. See `lib/api.ts` for why the resolver is browser-only.
 *
 * A failed lookup (not signed in, or the refresh failed) resolves to undefined
 * rather than throwing: the request goes out without a token and the API
 * answers 401, which the caller already has to handle.
 */
export function AuthTokenBridge({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAccessToken();

  useEffect(() => {
    setAccessTokenResolver(() =>
      Promise.resolve(getAccessToken()).catch(() => undefined)
    );
  }, [getAccessToken]);

  return children;
}
