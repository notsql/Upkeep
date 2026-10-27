import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { useContractors } from "@/lib/contractors";
import { EQUIPMENT_TYPES, useRoutingAccess } from "@/lib/report-routing";
import { useWorkOrderAccess } from "@/lib/work-orders";
import { ContractorRow } from "./-components/contractor-row";

export const Route = createFileRoute("/_auth/estates/$estateId/contractors/")({
  component: ContractorsPage,
  head: () => ({ meta: [{ title: "Contractors" }] }),
});

function ContractorsPage() {
  const { estateId } = Route.useParams();
  const access = useRoutingAccess(estateId);
  const estate = useWorkOrderAccess(estateId);
  const contractors = useContractors(estateId);
  const retry = useCallback(() => contractors.refetch(), [contractors.refetch]);
  if (access.pending) {
    return <p role="status">Loading access…</p>;
  }
  if (!access.canManage) {
    return <p role="alert">Contractors are available to managers only.</p>;
  }
  return (
    <main className="page-layout space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate.estateName ?? "Estate",
            to: estate.canViewManagement ? "/estates/$estateId" : undefined,
            params: { estateId },
          },
          { label: "Contractors" },
        ]}
        description="When a resident reports a fault in this equipment, its contractor is assigned the work order and receives it by email with the resident's words and photos."
        title="Contractors"
      />
      {contractors.isPending ? <p role="status">Loading contractors…</p> : null}
      {contractors.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            Unable to load contractors.{" "}
            <Button onClick={retry} variant="outline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
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
    </main>
  );
}
