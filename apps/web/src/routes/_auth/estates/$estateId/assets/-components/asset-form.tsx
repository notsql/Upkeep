import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@proj/ui/components/combobox";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
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
import { FormActions } from "@/components/form-actions";
import type { Asset, AssetInput } from "@/lib/assets";
import {
  type Manufacturer,
  useAssetCategories,
  useAssetModels,
  useManufacturers,
} from "@/lib/catalogue";
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

/**
 * A text field that suggests catalogue names as the user types, but accepts
 * any text: an unlisted name is added to the catalogue on save.
 */
function SuggestField({
  id,
  label,
  name,
  suggestions,
  value,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  suggestions: string[];
  value: string;
}) {
  const [open, setOpen] = useState(false);
  // Typing opens the suggestions; base-ui alone only opens on trusted input.
  const type = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(true);
    },
    [onChange]
  );
  const select = useCallback(
    (next: string | null) => {
      if (next !== null) {
        onChange(next);
      }
      setOpen(false);
    },
    [onChange]
  );
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        filter={null}
        inputValue={value}
        items={suggestions}
        onInputValueChange={type}
        onOpenChange={setOpen}
        onValueChange={select}
        open={open && suggestions.length > 0}
        value={value}
      >
        <ComboboxInput
          className="w-full"
          id={id}
          maxLength={200}
          name={name}
          showTrigger={false}
        />
        <ComboboxContent>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
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
      <p className="text-destructive text-sm" id={`${id}-${field}-error`}>
        {fieldErrors[field]}
      </p>
    ) : null;

  const submitLabel = initialValues ? "Save changes" : "Register asset";
  const buttonLabel = pending ? "Saving…" : submitLabel;
  return (
    <form
      className="form-surface mt-6 grid gap-5"
      noValidate
      onSubmit={handleSubmit}
    >
      <p className="text-muted-foreground text-sm">
        All fields are required unless marked optional.
      </p>
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
            <p className="text-destructive text-sm" role="alert">
              {categories.error.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-location`}>Location</Label>
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
      <FormActions label={buttonLabel} onCancel={onCancel} pending={pending} />
    </form>
  );
}
