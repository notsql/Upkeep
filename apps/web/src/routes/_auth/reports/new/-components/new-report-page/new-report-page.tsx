import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { useCallback } from "react";
import { FormPage } from "@/components/page/form-page";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useResidentContext } from "@/lib/reports";
import { NewReportForm } from "@/routes/_auth/reports/new/-components/new-report-page/new-report-form";

export function NewReportPage({
  requestedEstateId,
}: {
  requestedEstateId?: string;
} = {}) {
  const context = useResidentContext();
  const retry = useCallback(() => {
    context.refetch();
  }, [context]);

  if (!context.data) {
    // Same column as FormPage; the header appears once the estate is known.
    return (
      <PageLayout className="max-w-3xl">
        {context.isError ? (
          <ErrorState
            message="Unable to load your estate assignment. Please try again."
            onRetry={retry}
          />
        ) : (
          <LoadingState label="Loading your estate…" rows={1} />
        )}
      </PageLayout>
    );
  }
  const unavailable =
    !!requestedEstateId &&
    !context.data.estates.some((estate) => estate.id === requestedEstateId);
  return (
    <FormPage
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
      description="Tell your estate team what needs fixing and where"
      title="Report a fault"
    >
      {unavailable ? (
        <Alert>
          <AlertDescription>
            Reporting is unavailable for the selected estate. Choose an active
            Resident estate from the estate menu.
          </AlertDescription>
        </Alert>
      ) : null}
      {context.data.canSubmit || unavailable ? null : (
        <Alert>
          <AlertDescription>
            You have no estate assigned. Contact your estate manager before
            reporting a fault.
          </AlertDescription>
        </Alert>
      )}
      {context.data.canSubmit && !unavailable ? (
        <NewReportForm
          estates={context.data.estates}
          initialEstateId={requestedEstateId}
        />
      ) : null}
    </FormPage>
  );
}
