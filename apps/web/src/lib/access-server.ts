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

// The route guard needs `owned`, which only `GET /estates/{id}` carries.
// Returns null when the estate cannot be read, so callers fail closed.
export const getSessionEstate = createServerFn({ method: "GET" })
  .validator((estateId: string) => estateId)
  .handler(async ({ data: estateId }) => {
    const auth = await getAuth();
    if (!auth.user) {
      return null;
    }
    const client = createApiClient({
      baseUrl: env.VITE_API_URL,
      getToken: () => auth.accessToken,
    });
    const { data, error } = await client.GET("/estates/{id}", {
      params: { path: { id: estateId } },
    });
    return error || !data ? null : data;
  });
