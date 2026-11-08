import type { WorkOrderInput } from "@/lib/work-orders";
import { ReportSourcePicker } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/report-source-picker";
import type { useWorkOrderForm } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/use-work-order-form";
import { WorkOrderSelect } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-select";

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
    <div className="grid gap-5">
      <WorkOrderSelect
        disabled={form.inspectionSource}
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
    </div>
  );
}
