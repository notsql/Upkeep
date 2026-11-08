import {
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@proj/ui/components/field";
import type { ReactNode } from "react";
import { FormActions } from "@/components/forms/form-actions";
import { FormCard, FormPage } from "@/components/page/form-page";
import { LoadingState } from "@/components/states/loading-state";
import { useWorkOrderForm } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/use-work-order-form";
import { WorkOrderFormAssetFields } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-form-asset-fields";
import { WorkOrderFormDetailsFields } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-form-details-fields";
import { WorkOrderFormSourceStatus } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-form-source-status";
import {
  renderInspectionWorkOrderStatus,
  WorkOrderInspectionContext,
} from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-inspection-context";
import { WorkOrderSaveError } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-save-error";
import { WorkOrderSourceFields } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-source-fields";

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
  return (
    <FormPage
      breadcrumbs={[
        {
          label: "Work orders",
          to: "/estates/$estateId/work-orders",
          params: { estateId },
        },
        { label: "Create" },
      ]}
      description="Describe the work, where it is and how urgent it is"
      title="Create work order"
    >
      <WorkOrderFormBody estateId={estateId} form={form} />
    </FormPage>
  );
}

function WorkOrderFormBody({
  estateId,
  form,
}: {
  estateId: string;
  form: ReturnType<typeof useWorkOrderForm>;
}): ReactNode {
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
    <>
      <FormCard description="Where this work came from" title="Source">
        <div className="grid gap-5">
          <WorkOrderSourceFields estateId={estateId} form={form} />
          {form.inspectionSource ? (
            <WorkOrderInspectionContext inspection={form.inspection} />
          ) : null}
        </div>
      </FormCard>
      <FormCard>
        <form className="grid gap-5" onSubmit={form.submit}>
          <FieldSet>
            <FieldLegend>Work details</FieldLegend>
            <WorkOrderFormSourceStatus form={form} />
            <WorkOrderFormDetailsFields estateId={estateId} form={form} />
          </FieldSet>
          <FieldSeparator />
          <FieldSet>
            <FieldLegend>Asset</FieldLegend>
            <WorkOrderFormAssetFields estateId={estateId} form={form} />
          </FieldSet>
          <WorkOrderSaveError
            error={form.error}
            estateId={estateId}
            inspectionSource={form.inspectionSource}
            reloadSource={form.reloadSource}
            reportSource={form.reportSource}
          />
          <FormActions
            disabled={form.blocked}
            label="Create work order"
            onCancel={form.inspectionSource ? form.cancel : undefined}
            pending={form.pending}
          />
        </form>
      </FormCard>
    </>
  );
}
