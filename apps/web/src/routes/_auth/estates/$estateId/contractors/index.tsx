import { createFileRoute } from "@tanstack/react-router";
import { HardHat } from "lucide-react";
import { useCallback } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useContractors } from "@/lib/contractors";
import { pageHead } from "@/lib/page-title";
import { useRoutingAccess } from "@/lib/report-routing";
import { ContractorDialog } from "@/routes/_auth/estates/$estateId/contractors/-components/contractor-dialog";
import { ContractorTable } from "@/routes/_auth/estates/$estateId/contractors/-components/contractor-table";
import { DefaultContractors } from "@/routes/_auth/estates/$estateId/contractors/-components/default-contractors";

export const Route = createFileRoute("/_auth/estates/$estateId/contractors/")({
  component: ContractorsPage,
  head: () => pageHead("Contractors"),
});

function ContractorsPage() {
  const { estateId } = Route.useParams();
  const access = useRoutingAccess(estateId);
  const contractors = useContractors(estateId);
  const retry = useCallback(() => contractors.refetch(), [contractors.refetch]);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canManage) {
    return <p role="alert">Contractors are available to managers only.</p>;
  }
  return (
    <PageLayout className="space-y-4">
      <ListPageHeader
        description="The firms you can give jobs to. We email them the job details."
        icon={HardHat}
        title="Contractors"
      />
      <div>
        <ContractorDialog estateId={estateId} />
      </div>
      {contractors.isPending ? (
        <LoadingState label="Loading contractors…" />
      ) : null}
      {contractors.isError ? (
        <ErrorState message="Couldn't load contractors" onRetry={retry} />
      ) : null}
      {contractors.data ? (
        <>
          <ContractorTable contractors={contractors.data} estateId={estateId} />
          <DefaultContractors
            contractors={contractors.data}
            estateId={estateId}
          />
        </>
      ) : null}
    </PageLayout>
  );
}
