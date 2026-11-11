import { ClipboardPenLine } from "lucide-react";
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
            message="Couldn't load your estates. Try again."
            onRetry={retry}
          />
        ) : (
          <LoadingState label="Loading your estate…" rows={1} />
        )}
      </PageLayout>
    );
  }
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
      icon={ClipboardPenLine}
      title="Report a fault"
    >
      <NewReportForm
        estates={context.data.estates}
        initialEstateId={requestedEstateId}
      />
    </FormPage>
  );
}
