import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    /** Base URL of the Spring Boot API. The browser calls it directly. */
    VITE_API_URL: z.url().default("http://localhost:8080"),
    /** User inactivity before AuthKit signs out and requires authentication. */
    VITE_AUTH_IDLE_TIMEOUT_MINUTES: z.coerce.number().positive().default(30),
  },
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnv: import.meta.env,
});
