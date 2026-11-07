import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import type { useWorkOrderForm } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/use-work-order-form";
import { WorkOrderAssetPicker } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-asset-picker";
import { WorkOrderSourceLocationChoice } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-source-location-choice";

export function WorkOrderFormAssetFields({
  estateId,
  form,
}: {
  estateId: string;
  form: ReturnType<typeof useWorkOrderForm>;
}) {
  return (
    <>
      {form.inspectionSource && form.asset ? (
        <Field>
          <FieldLabel htmlFor="work-linked-asset">Linked asset</FieldLabel>
          <Button
            className="h-auto min-h-11 justify-start text-left whitespace-normal"
            disabled
            id="work-linked-asset"
            type="button"
            variant="outline"
          >
            {form.asset.reference} — {form.asset.name}
          </Button>
        </Field>
      ) : (
        <WorkOrderAssetPicker
          estateId={estateId}
          locationId={form.locationId}
          onChange={form.changeAsset}
        />
      )}
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
    </>
  );
}
