import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import type { Asset, AssetInput } from "@/lib/assets";
import {
  type Manufacturer,
  useAssetCategories,
  useAssetModels,
  useManufacturers,
} from "@/lib/catalogue";
import { flattenLocations, useLocations } from "@/lib/locations";

export interface FormValues {
  category: string;
  installedOn: string;
  locationId: string;
  manufacturer: string;
  model: string;
  name: string;
  serialNumber: string;
}

export type RequiredField = "name" | "category" | "locationId";

export type FieldErrors = Partial<Record<RequiredField, string>>;

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

export function useAssetForm(
  estateId: string,
  initialValues: Asset | undefined,
  onSave: (values: AssetInput) => Promise<unknown>
) {
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

  const submitLabel = initialValues ? "Save changes" : "Register asset";
  const buttonLabel = pending ? "Saving…" : submitLabel;
  return {
    buttonLabel,
    categoriesError: categories.error,
    categoryItems,
    error,
    errorProps,
    fieldErrors,
    handleCategoryChange,
    handleChange,
    handleInstalledOnChange,
    handleLocationChange,
    handleManufacturerChange,
    handleModelChange,
    handleSubmit,
    id,
    locationItems,
    locationsError: locations.error,
    manufacturerNames,
    modelNames,
    pending,
    values,
  };
}

export type AssetFormState = ReturnType<typeof useAssetForm>;
