import { Button } from "@proj/ui/components/button";
import { LoadingState } from "@/components/states/loading-state";
import { SourceReferenceField } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/source-reference-field";
import type { useWorkOrderForm } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/use-work-order-form";

export function WorkOrderFormSourceStatus({
  form,
}: {
  form: ReturnType<typeof useWorkOrderForm>;
}) {
  return (
    <>
      {form.reportSource && form.report.isPending && form.reportId ? (
        <LoadingState label="Loading source report…" rows={2} />
      ) : null}
      {form.reportSource && form.report.isError ? (
        <p role="alert">
          Source report unavailable.{" "}
          <Button onClick={form.reloadSource} type="button" variant="outline">
            Retry source
          </Button>
        </p>
      ) : null}
      {form.inspectionSource ? null : (
        <SourceReferenceField
          onChange={form.changeReference}
          source={form.source}
          value={form.sourceReference}
        />
      )}
    </>
  );
}
