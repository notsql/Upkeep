import { FormPageHeader } from "@/components/form-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { useWorkOrderForm } from "./use-work-order-form";
import { WorkOrderFormAssetFields } from "./work-order-form-asset-fields";
import { WorkOrderFormDetailsFields } from "./work-order-form-details-fields";
import { WorkOrderFormFooter } from "./work-order-form-footer";
import { WorkOrderFormSourceStatus } from "./work-order-form-source-status";
import {
  renderInspectionWorkOrderStatus,
  WorkOrderInspectionContext,
} from "./work-order-inspection-context";
import { WorkOrderSaveError } from "./work-order-save-error";
import { WorkOrderSourceFields } from "./work-order-source-fields";

export function WorkOrderForm({
  estateId,
  sourceReportId,
  sourceInspectionId,
}: {
  estateId: string;
  sourceReportId?: string;
  sourceInspectionId?: string;
}) {
  const form = useWorkOrderForm(estateId, sourceReportId, sourceInspectionId);
  if (form.access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!form.access.canCreate) {
    return <p role="alert">Work-order creation is unavailable.</p>;
  }
  const inspectionStatus = form.inspectionSource
    ? renderInspectionWorkOrderStatus(form.inspection, form.reloadSource)
    : null;
  if (inspectionStatus) {
    return inspectionStatus;
  }
  return (
    <PageLayout className="space-y-6">
      <FormPageHeader
        breadcrumbs={[
          {
            label: "Work orders",
            to: "/estates/$estateId/work-orders",
            params: { estateId },
          },
          { label: "Create" },
        ]}
        title="Create work order"
      />
      <WorkOrderSourceFields estateId={estateId} form={form} />
      {form.inspectionSource ? (
        <WorkOrderInspectionContext inspection={form.inspection} />
      ) : null}
      <form className="form-layout grid max-w-3xl gap-5" onSubmit={form.submit}>
        <WorkOrderFormSourceStatus form={form} />
        <WorkOrderFormDetailsFields estateId={estateId} form={form} />
        <WorkOrderFormAssetFields estateId={estateId} form={form} />
        <WorkOrderSaveError
          error={form.error}
          estateId={estateId}
          inspectionSource={form.inspectionSource}
          reloadSource={form.reloadSource}
          reportSource={form.reportSource}
        />
        <WorkOrderFormFooter form={form} />
      </form>
    </PageLayout>
  );
}
