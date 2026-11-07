import { Field, FieldLabel } from "@proj/ui/components/field";
import { Textarea } from "@proj/ui/components/textarea";
import type { WorkOrderInput } from "@/lib/work-orders";
import type { useWorkOrderForm } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/use-work-order-form";
import { WorkOrderLocationFeedback } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-location-feedback";
import { WorkOrderSelect } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-select";

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
export function WorkOrderFormDetailsFields({
  estateId,
  form,
}: {
  estateId: string;
  form: ReturnType<typeof useWorkOrderForm>;
}) {
  return (
    <>
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
        options={form.locationOptions}
        value={form.locationId}
      />
      {form.inspectionSource ? null : (
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
      )}
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
    </>
  );
}
