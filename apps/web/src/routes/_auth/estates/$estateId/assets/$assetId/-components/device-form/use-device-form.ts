import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import {
  type DeviceInput,
  type DeviceMetric,
  deviceMetrics,
  MAX_REPORTING_INTERVAL_SECONDS,
} from "@/lib/devices";
import { flattenLocations, useLocations } from "@/lib/locations";

interface FormValues {
  identifier: string;
  interval: string;
  locationId: string;
  model: string;
}

export type DeviceFormField =
  | "identifier"
  | "model"
  | "locationId"
  | "interval"
  | "metrics";

export type DeviceFieldErrors = Partial<Record<DeviceFormField, string>>;

export const catalogue = Object.entries(deviceMetrics) as [
  DeviceMetric,
  (typeof deviceMetrics)[DeviceMetric],
][];

function isWholeSecondsInRange(value: string): boolean {
  const seconds = Number(value);
  return (
    Number.isInteger(seconds) &&
    seconds >= 1 &&
    seconds <= MAX_REPORTING_INTERVAL_SECONDS
  );
}

function validate(
  values: FormValues,
  metrics: Set<DeviceMetric>
): DeviceFieldErrors {
  const errors: DeviceFieldErrors = {};
  if (!values.identifier.trim()) {
    errors.identifier = "Identifier is required.";
  }
  if (!values.model.trim()) {
    errors.model = "Model is required.";
  }
  if (!values.locationId) {
    errors.locationId = "Location is required.";
  }
  if (!values.interval.trim()) {
    errors.interval = "Reporting interval is required.";
  } else if (!isWholeSecondsInRange(values.interval)) {
    errors.interval = `Enter a whole number of seconds from 1 to ${MAX_REPORTING_INTERVAL_SECONDS}.`;
  }
  if (metrics.size === 0) {
    errors.metrics = "Choose at least one metric.";
  }
  return errors;
}

/** Details a replacement starts from: everything but the identifier (ID-45). */
export interface InitialDevice {
  locationId: string;
  metrics: DeviceMetric[];
  model: string;
  reportingIntervalSeconds: number;
}

export function useDeviceForm({
  defaultLocationId,
  estateId,
  initialDevice,
  onSave,
}: {
  defaultLocationId: string;
  estateId: string;
  initialDevice?: InitialDevice;
  onSave: (values: DeviceInput) => Promise<unknown>;
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
  const [values, setValues] = useState<FormValues>({
    identifier: "",
    model: initialDevice?.model ?? "",
    locationId: initialDevice?.locationId ?? defaultLocationId,
    interval: String(initialDevice?.reportingIntervalSeconds ?? 60),
  });
  const [metrics, setMetrics] = useState<Set<DeviceMetric>>(
    () => new Set(initialDevice?.metrics)
  );
  const [fieldErrors, setFieldErrors] = useState<DeviceFieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  const handleLocationChange = useCallback((value: string | null) => {
    setValues((current) => ({ ...current, locationId: value ?? "" }));
  }, []);

  const handleMetricChange = useCallback(
    (metric: DeviceMetric, checked: boolean) => {
      setMetrics((current) => {
        const next = new Set(current);
        if (checked) {
          next.add(metric);
        } else {
          next.delete(metric);
        }
        return next;
      });
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) {
        return;
      }
      const errors = validate(values, metrics);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        return;
      }
      setPending(true);
      setError(undefined);
      try {
        await onSave({
          identifier: values.identifier.trim(),
          model: values.model.trim(),
          locationId: values.locationId,
          // Catalogue order, so the request matches what the server stores.
          metrics: catalogue
            .map(([metric]) => metric)
            .filter((metric) => metrics.has(metric)),
          reportingIntervalSeconds: Number(values.interval),
        });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to register the device. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [metrics, onSave, pending, values]
  );

  const errorProps = (field: DeviceFormField) =>
    fieldErrors[field]
      ? { "aria-describedby": `${id}-${field}-error`, "aria-invalid": true }
      : {};

  return {
    error,
    errorProps,
    fieldErrors,
    handleChange,
    handleLocationChange,
    handleMetricChange,
    handleSubmit,
    id,
    locationItems,
    locationsError: locations.error,
    metrics,
    pending,
    values,
  };
}
