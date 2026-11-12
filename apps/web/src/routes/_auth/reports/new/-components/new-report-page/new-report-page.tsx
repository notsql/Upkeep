import { ClipboardPenLine } from "lucide-react";
import { useCallback } from "react";
import { FormPage } from "@/components/page/form-page";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useAppAccess } from "@/lib/access";
import { type ReportEstate, useResidentContext } from "@/lib/reports";
import { NewReportForm } from "@/routes/_auth/reports/new/-components/new-report-page/new-report-form";

export function NewReportPage({
  requestedEstateId,
}: {
  requestedEstateId?: string;
} = {}) {
  const context = useResidentContext();
  const access = useAppAccess();
  const retry = useCallback(() => {
    context.refetch();
  }, [context]);

  const ownEstates = context.data?.estates;
  const isOwn = ownEstates?.some((estate) => estate.id === requestedEstateId);
  const needsStaffEstate = Boolean(requestedEstateId) && !isOwn;
  if (!ownEstates || (needsStaffEstate && access.isPending)) {
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
  const staffEstate = needsStaffEstate
    ? access.data?.estates.find(
        (estate) => estate.estateId === requestedEstateId
      )
    : undefined;
  const estates: ReportEstate[] = staffEstate
    ? [
        ...ownEstates,
        { id: staffEstate.estateId, name: staffEstate.estateName },
      ]
    : ownEstates;
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
      <NewReportForm estates={estates} initialEstateId={requestedEstateId} />
    </FormPage>
  );
}
