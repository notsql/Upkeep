import { createApiClient } from "@proj/api";
import { env } from "@proj/env/web";

/**
 * Resolves the current AuthKit access token. AuthKit exposes the token through
 * a hook, but the API client is a module singleton, so `AuthTokenBridge`
 * (see `components/auth-provider.tsx`) installs the resolver once mounted.
 *
 * Deliberately browser-only. This app server-side renders, and a resolver set
 * at module scope on the server would be shared across requests - exactly the
 * leak `router.tsx` avoids by building the QueryClient per request. On the
 * server this stays undefined, so SSR fetches go out unauthenticated.
 */
let resolveAccessToken: (() => Promise<string | undefined>) | undefined;

export function setAccessTokenResolver(
  resolver: () => Promise<string | undefined>
): void {
  if (typeof window === "undefined") {
    return;
  }
  resolveAccessToken = resolver;
}

/**
 * Typed client for the Spring Boot API. Types come from the generated OpenAPI
 * schema, so a backend contract change surfaces here as a type error.
 *
 * The bearer token is attached per request when AuthKit is configured; until
 * then `getToken` resolves to undefined and requests go out unauthenticated,
 * matching the server, which leaves the API open until its issuer URI is set.
 */
export const api = createApiClient({
  baseUrl: env.VITE_API_URL,
  getToken: () => resolveAccessToken?.(),
});
