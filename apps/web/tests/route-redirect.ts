import { isRedirect } from "@tanstack/react-router";

interface RedirectOptions {
  params?: Record<string, string>;
  replace?: boolean;
  search?: Record<string, unknown>;
  to?: string;
}

/** Run a route's `beforeLoad` and return the redirect it throws, if any. */
export function redirectFrom(
  route: { options: { beforeLoad?: unknown } },
  context: { params: Record<string, string>; search?: Record<string, unknown> }
): RedirectOptions | undefined {
  const beforeLoad = route.options.beforeLoad as
    | ((value: unknown) => unknown)
    | undefined;
  if (!beforeLoad) {
    throw new Error("The route has no beforeLoad.");
  }
  try {
    beforeLoad({ search: {}, ...context });
  } catch (thrown) {
    if (isRedirect(thrown)) {
      return thrown.options as RedirectOptions;
    }
    throw thrown;
  }
  return undefined;
}
