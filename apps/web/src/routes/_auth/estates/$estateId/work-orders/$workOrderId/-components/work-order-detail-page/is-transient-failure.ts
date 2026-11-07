export function isTransientFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (
    !(
      error instanceof Error &&
      "status" in error &&
      typeof error.status === "number"
    )
  ) {
    return false;
  }
  return error.status === 0 || error.status >= 500;
}
