import { useCallback } from "react";
import { ErrorState } from "@/components/states/error-state";
import type { useSaveEstate } from "@/lib/estates";

export function EstateCreationStatus({
  createdEstate,
  refreshAccess,
}: Pick<ReturnType<typeof useSaveEstate>, "createdEstate" | "refreshAccess">) {
  const { mutate, isError } = refreshAccess;
  const retry = useCallback(() => {
    if (createdEstate) {
      mutate(createdEstate);
    }
  }, [createdEstate, mutate]);
  if (!createdEstate) {
    return null;
  }
  if (isError) {
    return (
      <ErrorState
        message="Estate created, but we could not refresh your access or open the estate. Try again to continue."
        onRetry={retry}
        retryLabel="Retry access"
      />
    );
  }
  return (
    <p aria-live="polite" role="status">
      Estate created. Refreshing your access…
    </p>
  );
}
