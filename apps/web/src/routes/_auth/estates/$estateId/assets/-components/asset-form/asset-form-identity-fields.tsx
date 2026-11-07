import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import type { Asset } from "@/lib/assets";
import { AssetFormRequiredError } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/asset-form-required-error";
import type { AssetFormState } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/use-asset-form";

type IdentityFieldsState = Pick<
  AssetFormState,
  | "categoriesError"
  | "categoryItems"
  | "errorProps"
  | "fieldErrors"
  | "handleCategoryChange"
  | "handleChange"
  | "handleLocationChange"
  | "id"
  | "locationItems"
  | "locationsError"
  | "values"
>;

export function AssetFormIdentityFields({
  form,
  initialValues,
}: {
  form: IdentityFieldsState;
  initialValues?: Asset;
}) {
  const {
    categoriesError,
    categoryItems,
    errorProps,
    fieldErrors,
    handleCategoryChange,
    handleChange,
    handleLocationChange,
    id,
    locationItems,
    locationsError,
    values,
  } = form;
  return (
    <>
      {initialValues ? (
        <Field>
          <FieldLabel htmlFor={`${id}-reference`}>Reference</FieldLabel>
          <Input
            id={`${id}-reference`}
            readOnly
            value={initialValues.reference}
          />
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
        <Input
          {...errorProps("name")}
          id={`${id}-name`}
          maxLength={200}
          name="name"
          onChange={handleChange}
          required
          value={values.name}
        />
        <AssetFormRequiredError
          field="name"
          fieldErrors={fieldErrors}
          id={id}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
        <Select
          items={categoryItems}
          onValueChange={handleCategoryChange}
          required
          value={values.category}
        >
          <SelectTrigger
            {...errorProps("category")}
            className="w-full"
            id={`${id}-category`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.slice(1).map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AssetFormRequiredError
          field="category"
          fieldErrors={fieldErrors}
          id={id}
        />
        {categoriesError ? (
          <Alert variant="destructive">
            <AlertDescription>{categoriesError.message}</AlertDescription>
          </Alert>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-location`}>Location</FieldLabel>
        <Select
          items={locationItems}
          onValueChange={handleLocationChange}
          required
          value={values.locationId}
        >
          <SelectTrigger
            {...errorProps("locationId")}
            className="w-full"
            id={`${id}-location`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locationItems.slice(1).map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AssetFormRequiredError
          field="locationId"
          fieldErrors={fieldErrors}
          id={id}
        />
        {locationsError ? (
          <Alert variant="destructive">
            <AlertDescription>{locationsError.message}</AlertDescription>
          </Alert>
        ) : null}
      </Field>
    </>
  );
}
