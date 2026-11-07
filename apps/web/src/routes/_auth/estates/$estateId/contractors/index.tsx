import { createFileRoute } from "@tanstack/react-router";
import { HardHat } from "lucide-react";
import { useCallback } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useContractors } from "@/lib/contractors";
import { pageHead } from "@/lib/page-title";
import { EQUIPMENT_TYPES, useRoutingAccess } from "@/lib/report-routing";
import { ContractorRow } from "@/routes/_auth/estates/$estateId/contractors/-components/contractor-row";

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
        description="When a resident reports a fault in this equipment, its contractor is assigned the work order and receives it by email with the resident's words and photos."
        icon={HardHat}
        title="Contractors"
      />
      {contractors.isPending ? (
        <LoadingState label="Loading contractors…" />
      ) : null}
      {contractors.isError ? (
        <ErrorState message="Unable to load contractors" onRetry={retry} />
      ) : null}
      {contractors.data
        ? EQUIPMENT_TYPES.map((type) => {
            const contractor = contractors.data.find(
              (item) => item.equipmentType === type.value
            );
            return (
              <ContractorRow
                contractor={contractor}
                estateId={estateId}
                key={`${type.value}:${contractor?.updatedAt ?? "none"}`}
                label={type.label}
                type={type.value}
              />
            );
          })
        : null}
    </PageLayout>
  );
}
