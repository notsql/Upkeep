import { createApiClient } from "@proj/api";
import { env } from "@proj/env/web";
import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@workos/authkit-tanstack-react-start";

export const getSessionIdentity = createServerFn({ method: "GET" }).handler(
  async () => {
    const { user } = await getAuth();
    return user ?? null;
  }
);

// A fresh client keeps this request's bearer token out of the browser singleton
// and other SSR requests. Only identity and the access projection are returned.
export const getSessionAccess = createServerFn({ method: "GET" }).handler(
  async () => {
    const auth = await getAuth();
    if (!auth.user) {
      return { user: null, access: null };
    }
    const client = createApiClient({
      baseUrl: env.VITE_API_URL,
      getToken: () => auth.accessToken,
    });
    const { data, error } = await client.GET("/access/context");
    if (error || !data) {
      throw new Error("Unable to resolve your access. Please try again.");
    }
    return { user: auth.user, access: data };
  }
);
