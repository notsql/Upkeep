import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { DatePicker } from "@/components/forms/date-picker";
import { SuggestField } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/suggest-field";
import type { AssetFormState } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/use-asset-form";

type DetailFieldsState = Pick<
  AssetFormState,
  | "handleChange"
  | "handleInstalledOnChange"
  | "handleManufacturerChange"
  | "handleModelChange"
  | "id"
  | "manufacturerNames"
  | "modelNames"
  | "values"
>;

export function AssetFormDetailFields({ form }: { form: DetailFieldsState }) {
  const {
    handleChange,
    handleInstalledOnChange,
    handleManufacturerChange,
    handleModelChange,
    id,
    manufacturerNames,
    modelNames,
    values,
  } = form;
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-installed-on`}>
          Installation date (optional)
        </FieldLabel>
        <DatePicker
          id={`${id}-installed-on`}
          onChange={handleInstalledOnChange}
          value={values.installedOn}
        />
      </Field>
      <SuggestField
        id={`${id}-manufacturer`}
        label="Manufacturer (optional)"
        name="manufacturer"
        onChange={handleManufacturerChange}
        suggestions={manufacturerNames}
        value={values.manufacturer}
      />
      <SuggestField
        id={`${id}-model`}
        label="Model (optional)"
        name="model"
        onChange={handleModelChange}
        suggestions={modelNames}
        value={values.model}
      />
      <Field>
        <FieldLabel htmlFor={`${id}-serial-number`}>
          Serial number (optional)
        </FieldLabel>
        <Input
          id={`${id}-serial-number`}
          maxLength={200}
          name="serialNumber"
          onChange={handleChange}
          value={values.serialNumber}
        />
      </Field>
    </>
  );
}
