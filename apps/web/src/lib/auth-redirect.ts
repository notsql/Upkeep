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

export function getCurrentReturnTo(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return sanitizeReturnTo(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

/**
 * Restore the route requested before authentication without reloading React.
 * AuthKit has already updated its provider state when this runs, so keeping the
 * current document alive lets consumers immediately observe the signed-in user.
 */
export function restoreReturnTo(value: unknown): void {
  const returnTo = sanitizeReturnTo(value);

  window.history.replaceState({}, "", returnTo);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
