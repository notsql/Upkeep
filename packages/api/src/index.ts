import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./schema";

export type ApiClient = ReturnType<typeof createClient<paths>>;

export interface CreateApiClientOptions {
  /** Base URL of the Spring Boot API, e.g. http://localhost:8080 */
  baseUrl: string;
  /**
   * Resolves the bearer token for each request. Return `undefined` to send the
   * request unauthenticated - useful locally, where WorkOS is not configured.
   */
  getToken?: () => Promise<string | undefined> | string | undefined;
}

/**
 * Typed client for the Spring Boot API. Every path, parameter and response
 * shape comes from `schema.ts`, which is generated from the server's OpenAPI
 * document - do not hand-write request types.
 */
export function createApiClient({
  baseUrl,
  getToken,
}: CreateApiClientOptions): ApiClient {
  const client = createClient<paths>({ baseUrl });

  if (getToken) {
    const auth: Middleware = {
      async onRequest({ request }) {
        const token = await getToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
        return request;
      },
    };
    client.use(auth);
  }

  return client;
}
