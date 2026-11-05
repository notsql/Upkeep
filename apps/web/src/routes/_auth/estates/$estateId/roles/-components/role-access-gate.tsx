import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { type ReactNode, useCallback } from "react";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { useEstateRoleAccess } from "@/lib/estate-roles";

type EstateAccess = components["schemas"]["EstateAccessResponse"];

/** Shared access check for the roles list, new-role and edit-role pages. */
export function RoleAccessGate({
  estateId,
  children,
}: {
  estateId: string;
  children: (estate: EstateAccess) => ReactNode;
}) {
  const { access, estate, ready, allowed } = useEstateRoleAccess(estateId);
  const retry = useCallback(() => {
    access.refetch();
  }, [access]);
  let content: ReactNode;
  if (!ready || access.isPending) {
    content = <LoadingState label="Loading estate access…" rows={2} />;
  } else if (access.error) {
    content = (
      <ErrorState
        message={access.error.message}
        onRetry={retry}
        retryLabel="Retry access"
      />
    );
  } else if (allowed && estate) {
    content = children(estate);
  } else {
    content = (
      <Alert role="alert">
        <AlertDescription>Estate roles unavailable</AlertDescription>
      </Alert>
    );
  }
  return <PageLayout>{content}</PageLayout>;
}
