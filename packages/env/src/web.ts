import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    /** Base URL of the Spring Boot API. The browser calls it directly. */
    VITE_API_URL: z.url().default("http://localhost:8080"),
    /**
     * WorkOS AuthKit client ID. Optional on purpose: while it is unset the app
     * runs unauthenticated, mirroring the server, which leaves the API open
     * until its issuer URI is configured.
     */
    VITE_WORKOS_CLIENT_ID: z.string().min(1).optional(),
    /**
     * Where AuthKit returns the browser after login. Must be registered as a
     * redirect URI in the WorkOS dashboard.
     */
    VITE_WORKOS_REDIRECT_URI: z.url().default("http://localhost:3001"),
    /** User inactivity before AuthKit signs out and requires authentication. */
    VITE_AUTH_IDLE_TIMEOUT_MINUTES: z.coerce.number().positive().default(30),
  },
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnv: import.meta.env,
});
