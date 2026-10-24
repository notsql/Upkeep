import { Field, FieldLabel } from "@proj/ui/components/field";
import { Textarea } from "@proj/ui/components/textarea";
import type { ChangeEvent } from "react";
import type { WorkOrderInput } from "@/lib/work-orders";
import { ReportSourcePicker } from "./report-source-picker";
import type { useWorkOrderForm } from "./use-work-order-form";
import { WorkOrderSelect } from "./work-order-select";

const sources: { value: WorkOrderInput["source"]; label: string }[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "RESIDENT_REPORT", label: "Resident report" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "MAINTENANCE_RECOMMENDATION", label: "Maintenance recommendation" },
];
export function WorkOrderSourceFields({
  estateId,
  form,
}: {
  estateId: string;
  form: ReturnType<typeof useWorkOrderForm>;
}) {
  return (
    <section aria-label="Work-order source" className="grid max-w-3xl gap-5">
      <WorkOrderSelect
        label="Source"
        onChange={form.sourceChanged}
        options={sources.filter(
          (item) =>
            item.value !== "RESIDENT_REPORT" || form.access.canReadReports
        )}
        value={form.source}
      />
      {form.reportSource && form.access.canReadReports ? (
        <ReportSourcePicker
          estateId={estateId}
          onChange={form.setReportId}
          selectedTitle={form.report.data?.title}
          value={form.reportId}
        />
      ) : null}
    </section>
  );
}

export function SourceReferenceField({
  source,
  value,
  onChange,
}: {
  source: WorkOrderInput["source"];
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  if (source !== "INSPECTION" && source !== "MAINTENANCE_RECOMMENDATION") {
    return null;
  }
  return (
    <Field>
      <FieldLabel htmlFor="work-source-reference">
        Source reference or explanation
      </FieldLabel>
      <Textarea
        id="work-source-reference"
        maxLength={500}
        onChange={onChange}
        required
        value={value}
      />
    </Field>
  );
}
