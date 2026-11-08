import { Alert, AlertDescription } from "@proj/ui/components/alert";
import {
  FieldDescription,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@proj/ui/components/field";
import { FormActions } from "@/components/forms/form-actions";
import { FormCard } from "@/components/page/form-page";
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
    <FormCard>
      <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
        <FieldDescription>
          All fields are required unless marked optional.
        </FieldDescription>
        <FieldSet disabled={pending}>
          <FieldLegend>Asset</FieldLegend>
          <AssetFormIdentityFields form={form} initialValues={initialValues} />
        </FieldSet>
        <FieldSeparator />
        <FieldSet disabled={pending}>
          <FieldLegend>Equipment details</FieldLegend>
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
    </FormCard>
  );
}
