import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { useCallback } from "react";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { FormPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useResidentContext } from "@/lib/reports";
import { NewReportForm } from "@/routes/_auth/reports/new/-components/new-report-form";

export function NewReportPage({
  requestedEstateId,
}: {
  requestedEstateId?: string;
} = {}) {
  const context = useResidentContext();
  const unavailable =
    !!context.data &&
    !!requestedEstateId &&
    !context.data.estates.some((estate) => estate.id === requestedEstateId);
  const retry = useCallback(() => {
    context.refetch();
  }, [context]);

  return (
    <PageLayout>
      {context.data ? (
        <FormPageHeader
          breadcrumbs={[
            {
              label: "My reports",
              search: requestedEstateId
                ? { estateId: requestedEstateId }
                : undefined,
              to: "/reports",
            },
            { label: "Report a fault" },
          ]}
          title="Report a fault"
        />
      ) : null}
      {context.isPending ? (
        <LoadingState label="Loading your estate…" rows={1} />
      ) : null}
      {context.isError ? (
        <ErrorState
          message="Unable to load your estate assignment. Please try again."
          onRetry={retry}
        />
      ) : null}
      {unavailable ? (
        <Alert role="alert">
          <AlertDescription>
            Reporting is unavailable for the selected estate. Choose an active
            Resident estate from the estate menu.
          </AlertDescription>
        </Alert>
      ) : null}
      {context.data && !context.data.canSubmit && !unavailable ? (
        <Alert role="alert">
          <AlertDescription>
            You have no estate assigned. Contact your estate manager before
            reporting a fault.
          </AlertDescription>
        </Alert>
      ) : null}
      {context.data?.canSubmit && !unavailable ? (
        <NewReportForm
          estates={context.data.estates}
          initialEstateId={requestedEstateId}
        />
      ) : null}
    </PageLayout>
  );
}
