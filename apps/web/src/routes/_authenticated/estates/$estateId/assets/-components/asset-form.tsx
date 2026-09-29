import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@proj/ui/components/native-select";
import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import {
  type Asset,
  type AssetCategory,
  type AssetInput,
  assetCategoryLabel,
} from "@/lib/assets";
import { flattenLocations, useLocations } from "@/lib/locations";

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

function isCategory(value: string): value is AssetCategory {
  return value in assetCategoryLabel;
}

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
function toPayload(values: FormValues, category: AssetCategory): AssetInput {
  const optional = {
    installedOn: values.installedOn.trim(),
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    serialNumber: values.serialNumber.trim(),
  };
  return {
    name: values.name.trim(),
    category,
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
}: {
  estateId: string;
  initialValues?: Asset;
  onSave: (values: AssetInput) => Promise<unknown>;
}) {
  const id = useId();
  const locations = useLocations(estateId);
  const locationOptions = useMemo(
    () => flattenLocations(locations.data ?? []),
    [locations.data]
  );
  const [values, setValues] = useState(() => initialFormValues(initialValues));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = event.target;
      setValues((current) => ({ ...current, [name]: value }));
    },
    []
  );

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
      if (!isCategory(values.category)) {
        missing.category = requiredMessages.category;
      }
      setFieldErrors(missing);
      if (Object.keys(missing).length > 0 || !isCategory(values.category)) {
        return;
      }
      setPending(true);
      setError(undefined);
      try {
        await onSave(toPayload(values, values.category));
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
    [onSave, pending, values]
  );

  const errorProps = (field: RequiredField) =>
    fieldErrors[field]
      ? { "aria-describedby": `${id}-${field}-error`, "aria-invalid": true }
      : {};
  const errorText = (field: RequiredField) =>
    fieldErrors[field] ? (
      <p className="text-destructive text-sm" id={`${id}-${field}-error`}>
        {fieldErrors[field]}
      </p>
    ) : null;

  const submitLabel = initialValues ? "Save changes" : "Register asset";
  const buttonLabel = pending ? "Saving…" : submitLabel;
  return (
    <form className="mt-6 grid gap-5" noValidate onSubmit={handleSubmit}>
      <fieldset className="grid gap-5" disabled={pending}>
        <legend className="sr-only">Asset details</legend>
        {initialValues ? (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-reference`}>Reference</Label>
            <Input
              id={`${id}-reference`}
              readOnly
              value={initialValues.reference}
            />
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>Name</Label>
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
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-category`}>Category</Label>
          <NativeSelect
            {...errorProps("category")}
            className="w-full"
            id={`${id}-category`}
            name="category"
            onChange={handleChange}
            required
            value={values.category}
          >
            <NativeSelectOption value="">Select a category</NativeSelectOption>
            {Object.entries(assetCategoryLabel).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errorText("category")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-location`}>Location</Label>
          <NativeSelect
            {...errorProps("locationId")}
            className="w-full"
            id={`${id}-location`}
            name="locationId"
            onChange={handleChange}
            required
            value={values.locationId}
          >
            <NativeSelectOption value="">
              {locations.isPending ? "Loading locations…" : "Select a location"}
            </NativeSelectOption>
            {locationOptions.map((node) => (
              <NativeSelectOption key={node.id} value={node.id}>
                {node.path.join(" › ")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errorText("locationId")}
          {locations.error ? (
            <p className="text-destructive text-sm" role="alert">
              {locations.error.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-installed-on`}>
            Installation date (optional)
          </Label>
          <Input
            id={`${id}-installed-on`}
            name="installedOn"
            onChange={handleChange}
            type="date"
            value={values.installedOn}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-manufacturer`}>Manufacturer (optional)</Label>
          <Input
            id={`${id}-manufacturer`}
            maxLength={200}
            name="manufacturer"
            onChange={handleChange}
            value={values.manufacturer}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-model`}>Model (optional)</Label>
          <Input
            id={`${id}-model`}
            maxLength={200}
            name="model"
            onChange={handleChange}
            value={values.model}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-serial-number`}>
            Serial number (optional)
          </Label>
          <Input
            id={`${id}-serial-number`}
            maxLength={200}
            name="serialNumber"
            onChange={handleChange}
            value={values.serialNumber}
          />
        </div>
      </fieldset>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="justify-self-start" disabled={pending} type="submit">
        {buttonLabel}
      </Button>
    </form>
  );
}
