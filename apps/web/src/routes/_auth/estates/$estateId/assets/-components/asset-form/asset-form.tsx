import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@proj/ui/components/field";
import { FormActions } from "@/components/forms/form-actions";
import type { Asset, AssetInput } from "@/lib/assets";
import { AssetFormDetailFields } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/asset-form-detail-fields";
import { AssetFormIdentityFields } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/asset-form-identity-fields";
import { useAssetForm } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/use-asset-form";

export function AssetForm({
  estateId,
  initialValues,
  onSave,
  onCancel,
}: {
  estateId: string;
  initialValues?: Asset;
  onCancel?: () => void;
  onSave: (values: AssetInput) => Promise<unknown>;
}) {
  const form = useAssetForm(estateId, initialValues, onSave);
  const { buttonLabel, error, handleSubmit, pending } = form;
  return (
    <Card className="mt-6">
      <CardContent>
        <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
          <FieldDescription>
            All fields are required unless marked optional.
          </FieldDescription>
          <FieldSet disabled={pending}>
            <FieldLegend className="sr-only">Asset details</FieldLegend>
            <AssetFormIdentityFields
              form={form}
              initialValues={initialValues}
            />
            <AssetFormDetailFields form={form} />
          </FieldSet>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormActions
            label={buttonLabel}
            onCancel={onCancel}
            pending={pending}
          />
        </form>
      </CardContent>
    </Card>
  );
}
