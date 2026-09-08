import { createApiClient } from "@proj/api";
import { env } from "@proj/env/web";

/**
 * Typed client for the Spring Boot API. Types come from the generated OpenAPI
 * schema, so a backend contract change surfaces here as a type error.
 *
 * When Okta is wired up, pass `getToken` to attach the bearer token.
 */
export const api = createApiClient({ baseUrl: env.VITE_API_URL });
