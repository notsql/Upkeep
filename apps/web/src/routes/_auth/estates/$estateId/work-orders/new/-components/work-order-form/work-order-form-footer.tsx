import { Button } from "@proj/ui/components/button";
import type { useWorkOrderForm } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/use-work-order-form";

export function WorkOrderFormFooter({
  form,
}: {
  form: ReturnType<typeof useWorkOrderForm>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-5">
      <Button disabled={form.blocked} type="submit">
        Create work order
      </Button>
      {form.inspectionSource ? (
        <Button
          disabled={form.pending}
          onClick={form.cancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
