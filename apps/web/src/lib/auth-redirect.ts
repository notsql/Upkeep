function getValidationOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // URL parsing requires an absolute base during SSR. The value is used only
  // for the same-origin comparison; successful results remain relative paths.
  return "http://localhost";
}

/**
 * Accept only paths within this application. OAuth state is returned through
 * the browser and must not be trusted as a redirect URL.
 */
export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  try {
    const validationOrigin = getValidationOrigin();
    const url = new URL(value, validationOrigin);
    if (url.origin !== validationOrigin) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function buildSignInPath(returnTo: unknown): string {
  const search = new URLSearchParams({
    returnPathname: sanitizeReturnTo(returnTo),
  });
  return `/api/auth/sign-in?${search.toString()}`;
}

export function buildSignOutPath(returnTo: unknown): string {
  const search = new URLSearchParams({
    returnTo: sanitizeReturnTo(returnTo),
  });
  return `/logout?${search.toString()}`;
}

export function startServerSignOut(returnTo: unknown): void {
  window.location.assign(buildSignOutPath(returnTo));
}
