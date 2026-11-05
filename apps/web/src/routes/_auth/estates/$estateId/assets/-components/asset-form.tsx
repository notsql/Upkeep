import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { DatePicker } from "@/components/date-picker";
import { FormActions } from "@/components/form-actions";
import type { Asset, AssetInput } from "@/lib/assets";
import {
  type Manufacturer,
  useAssetCategories,
  useAssetModels,
  useManufacturers,
} from "@/lib/catalogue";
import { flattenLocations, useLocations } from "@/lib/locations";
import { SuggestField } from "@/routes/_auth/estates/$estateId/assets/-components/suggest-field";

interface FormValues {
  category: string;
  installedOn: string;
  locationId: string;
  manufacturer: string;
  model: string;
  name: string;
  serialNumber: string;
}

type RequiredField = "name" | "category" | "locationId";

type FieldErrors = Partial<Record<RequiredField, string>>;

const requiredMessages: Record<RequiredField, string> = {
  name: "Name is required.",
  category: "Category is required.",
  locationId: "Location is required.",
};

function initialFormValues(asset?: Asset): FormValues {
  return {
    name: asset?.name ?? "",
    category: asset?.category ?? "",
    locationId: asset?.locationId ?? "",
    installedOn: asset?.installedOn ?? "",
    manufacturer: asset?.manufacturer ?? "",
    model: asset?.model ?? "",
    serialNumber: asset?.serialNumber ?? "",
  };
}

/** Trims every field and leaves blank optional details out. */
function toPayload(values: FormValues): AssetInput {
  const optional = {
    installedOn: values.installedOn.trim(),
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    serialNumber: values.serialNumber.trim(),
  };
  return {
    name: values.name.trim(),
    category: values.category,
    locationId: values.locationId,
    ...Object.fromEntries(
      Object.entries(optional).filter(([, value]) => value !== "")
    ),
  };
}

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
  const id = useId();
  const locations = useLocations(estateId);
  // The first item is the placeholder shown while nothing is chosen.
  const locationItems = useMemo(
    () => [
      {
        value: "",
        label: locations.isPending ? "Loading locations…" : "Select a location",
      },
      ...flattenLocations(locations.data ?? []).map((node) => ({
        value: node.id,
        label: node.path.join(" › "),
      })),
    ],
    [locations.data, locations.isPending]
  );
  const categories = useAssetCategories();
  // The first item is the placeholder shown while nothing is chosen.
  const categoryItems = useMemo(
    () => [
      {
        value: "",
        label: categories.isPending
          ? "Loading categories…"
          : "Select a category",
      },
      ...(categories.data ?? []).map((category) => ({
        value: category.code,
        label: category.label,
      })),
    ],
    [categories.data, categories.isPending]
  );
  const [values, setValues] = useState(() => initialFormValues(initialValues));
  // The listed manufacturer the user picked; models are only suggested for it.
  const [chosenManufacturer, setChosenManufacturer] = useState<Manufacturer>();
  const manufacturers = useManufacturers(values.manufacturer);
  const manufacturerId =
    chosenManufacturer?.name === values.manufacturer
      ? chosenManufacturer.id
      : undefined;
  const models = useAssetModels(manufacturerId, values.category, values.model);
  const manufacturerNames = useMemo(
    () => (manufacturers.data ?? []).map((manufacturer) => manufacturer.name),
    [manufacturers.data]
  );
  const modelNames = useMemo(
    () => (manufacturerId ? (models.data ?? []) : []).map((m) => m.name),
    [manufacturerId, models.data]
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  const handleLocationChange = useCallback((value: string | null) => {
    setValues((current) => ({ ...current, locationId: value ?? "" }));
  }, []);

  const handleManufacturerChange = useCallback(
    (value: string) => {
      setValues((current) => ({ ...current, manufacturer: value }));
      const listed = manufacturers.data?.find(
        (manufacturer) => manufacturer.name === value
      );
      if (listed) {
        setChosenManufacturer(listed);
      }
    },
    [manufacturers.data]
  );

  const handleInstalledOnChange = useCallback((value: string) => {
    setValues((current) => ({ ...current, installedOn: value }));
  }, []);

  const handleModelChange = useCallback((value: string) => {
    setValues((current) => ({ ...current, model: value }));
  }, []);

  const handleCategoryChange = useCallback((value: string | null) => {
    setValues((current) => ({ ...current, category: value ?? "" }));
  }, []);

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) {
        return;
      }
      const missing: FieldErrors = {};
      if (!values.name.trim()) {
        missing.name = requiredMessages.name;
      }
      if (!values.locationId) {
        missing.locationId = requiredMessages.locationId;
      }
      const isCategory = categoryItems.some(
        (item) => item.value !== "" && item.value === values.category
      );
      if (!isCategory) {
        missing.category = requiredMessages.category;
      }
      setFieldErrors(missing);
      if (Object.keys(missing).length > 0) {
        return;
      }
      setPending(true);
      setError(undefined);
      try {
        await onSave(toPayload(values));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to save the asset. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [categoryItems, onSave, pending, values]
  );

  const errorProps = (field: RequiredField) =>
    fieldErrors[field]
      ? { "aria-describedby": `${id}-${field}-error`, "aria-invalid": true }
      : {};
  const errorText = (field: RequiredField) =>
    fieldErrors[field] ? (
      <FieldError id={`${id}-${field}-error`}>{fieldErrors[field]}</FieldError>
    ) : null;

  const submitLabel = initialValues ? "Save changes" : "Register asset";
  const buttonLabel = pending ? "Saving…" : submitLabel;
  return (
    <Card className="mt-6">
      <CardContent>
        <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
          <FieldDescription>
            All fields are required unless marked optional.
          </FieldDescription>
          <FieldSet disabled={pending}>
            <FieldLegend className="sr-only">Asset details</FieldLegend>
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
              {errorText("name")}
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
              {errorText("category")}
              {categories.error ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {categories.error.message}
                  </AlertDescription>
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
              {errorText("locationId")}
              {locations.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{locations.error.message}</AlertDescription>
                </Alert>
              ) : null}
            </Field>
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
