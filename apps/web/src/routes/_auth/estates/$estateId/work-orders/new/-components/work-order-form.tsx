import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Textarea } from "@proj/ui/components/textarea";
import { FormActions } from "@/components/form-actions";
import { PageHeader } from "@/components/page-header";
import type { WorkOrderInput } from "@/lib/work-orders";
import { useWorkOrderForm } from "./use-work-order-form";
import { WorkOrderAssetPicker } from "./work-order-asset-picker";
import { WorkOrderLocationFeedback } from "./work-order-location-feedback";
import { WorkOrderSaveError } from "./work-order-save-error";
import { WorkOrderSelect } from "./work-order-select";
import {
  SourceReferenceField,
  WorkOrderSourceFields,
} from "./work-order-source-fields";
import { WorkOrderSourceLocationChoice } from "./work-order-source-location-choice";

const categories: { value: WorkOrderInput["category"]; label: string }[] = [
  { value: "EQUIPMENT_FAULT", label: "Equipment fault" },
  { value: "CLEANLINESS", label: "Cleanliness" },
  { value: "SAFETY", label: "Safety" },
];
const priorities: { value: WorkOrderInput["priority"]; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];
export function WorkOrderForm({
  estateId,
  sourceReportId,
}: {
  estateId: string;
  sourceReportId?: string;
}) {
  const form = useWorkOrderForm(estateId, sourceReportId);
  if (form.access.pending) {
    return <p role="status">Loading access…</p>;
  }
  if (!form.access.canCreate) {
    return <p role="alert">Work-order creation is unavailable.</p>;
  }
  return (
    <main className="page-layout space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: form.access.estateName ?? "Estate",
            to: form.access.canViewManagement
              ? "/estates/$estateId"
              : undefined,
            params: { estateId },
          },
          {
            label: "Work orders",
            to: "/estates/$estateId/work-orders",
            params: { estateId },
          },
          { label: "Create" },
        ]}
        description={form.access.estateName}
        title="Create work order"
      />
      <WorkOrderSourceFields estateId={estateId} form={form} />
      <form className="form-layout grid max-w-3xl gap-5" onSubmit={form.submit}>
        {form.reportSource && form.report.isPending && form.reportId ? (
          <p role="status">Loading source report…</p>
        ) : null}
        {form.reportSource && form.report.isError ? (
          <p role="alert">
            Source report unavailable.{" "}
            <Button onClick={form.reloadSource} type="button">
              Retry source
            </Button>
          </p>
        ) : null}
        <SourceReferenceField
          onChange={form.changeReference}
          source={form.source}
          value={form.sourceReference}
        />
        <Field>
          <FieldLabel htmlFor="work-description">Description</FieldLabel>
          <Textarea
            id="work-description"
            maxLength={2500}
            onChange={form.changeDescription}
            required
            value={form.description}
          />
        </Field>
        <WorkOrderSelect
          disabled={!!form.asset}
          label="Location"
          onChange={form.setLocation}
          options={form.options.map((item) => ({
            value: item.id,
            label: item.path.join(" / "),
          }))}
          value={form.locationId}
        />
        <WorkOrderLocationFeedback
          estateId={estateId}
          expectedSourceLocationId={
            form.reportSource ? form.expectedLocation : undefined
          }
          failed={form.locations.isError}
          locations={form.options}
          onRetry={form.retryLocations}
          pending={form.locations.isPending}
        />
        <WorkOrderSelect
          label="Category"
          onChange={form.categoryChanged}
          options={categories}
          value={form.category}
        />
        <WorkOrderSelect
          disabled={form.category === "SAFETY"}
          label="Priority"
          onChange={form.setPriority}
          options={priorities}
          value={form.priority}
        />
        <WorkOrderAssetPicker
          estateId={estateId}
          locationId={form.locationId}
          onChange={form.changeAsset}
        />
        <WorkOrderSourceLocationChoice
          incompatibleAsset={!form.canUseSource}
          onKeepWork={form.keepWorkLocation}
          onUseSource={form.useSourceLocation}
          sourceLocation={form.sourceChoice?.label}
          workLocation={
            form.options
              .find((item) => item.id === form.locationId)
              ?.path.join(" / ") ?? form.locationId
          }
        />
        <WorkOrderSaveError
          error={form.error}
          estateId={estateId}
          reloadSource={form.reloadSource}
          reportSource={form.reportSource}
        />
        <FormActions label="Create work order" pending={form.blocked} />
      </form>
    </main>
  );
}
