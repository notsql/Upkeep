import { Button } from "@proj/ui/components/button";
import { Checkbox } from "@proj/ui/components/checkbox";
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

type Field = "identifier" | "model" | "locationId" | "interval" | "metrics";
type FieldErrors = Partial<Record<Field, string>>;

const catalogue = Object.entries(deviceMetrics) as [
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

function validate(values: FormValues, metrics: Set<DeviceMetric>): FieldErrors {
  const errors: FieldErrors = {};
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

function MetricOption({
  checked,
  disabled,
  id,
  label,
  metric,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: string;
  metric: DeviceMetric;
  onChange: (metric: DeviceMetric, checked: boolean) => void;
}) {
  const handleCheckedChange = useCallback(
    (next: boolean) => onChange(metric, next),
    [metric, onChange]
  );
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2">
      <Checkbox
        checked={checked}
        disabled={disabled}
        id={id}
        name="metrics"
        onCheckedChange={handleCheckedChange}
        value={metric}
      />
      <Label className="text-sm" htmlFor={id}>
        {label}
      </Label>
    </div>
  );
}

export function DeviceForm({
  defaultLocationId,
  estateId,
  onSave,
  onCancel,
}: {
  defaultLocationId: string;
  estateId: string;
  onSave: (values: DeviceInput) => Promise<unknown>;
  onCancel?: () => void;
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
    model: "",
    locationId: defaultLocationId,
    interval: "60",
  });
  const [metrics, setMetrics] = useState<Set<DeviceMetric>>(() => new Set());
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

  const errorProps = (field: Field) =>
    fieldErrors[field]
      ? { "aria-describedby": `${id}-${field}-error`, "aria-invalid": true }
      : {};
  const errorText = (field: Field) =>
    fieldErrors[field] ? (
      <p className="text-destructive text-sm" id={`${id}-${field}-error`}>
        {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <form className="mt-4 grid gap-5" noValidate onSubmit={handleSubmit}>
      <fieldset className="grid gap-5" disabled={pending}>
        <legend className="mb-3 font-semibold">Device identity</legend>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-identifier`}>Identifier</Label>
          <Input
            {...errorProps("identifier")}
            id={`${id}-identifier`}
            maxLength={100}
            name="identifier"
            onChange={handleChange}
            required
            value={values.identifier}
          />
          {errorText("identifier")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-model`}>Model</Label>
          <Input
            {...errorProps("model")}
            id={`${id}-model`}
            maxLength={200}
            name="model"
            onChange={handleChange}
            required
            value={values.model}
          />
          {errorText("model")}
        </div>
      </fieldset>
      <fieldset className="grid gap-3" disabled={pending}>
        <legend className="mb-3 font-semibold">Location</legend>
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
      </fieldset>
      <fieldset
        disabled={pending}
        {...errorProps("metrics")}
        className="grid gap-2 sm:grid-cols-2"
      >
        <legend className="mb-2 font-medium text-sm">Supported metrics</legend>
        {catalogue.map(([metric, { name, unit }]) => (
          <MetricOption
            checked={metrics.has(metric)}
            // A fieldset does not disable the non-native checkbox.
            disabled={pending}
            id={`${id}-metric-${metric}`}
            key={metric}
            label={`${name} (${unit})`}
            metric={metric}
            onChange={handleMetricChange}
          />
        ))}
        {errorText("metrics")}
      </fieldset>
      <fieldset className="grid gap-3" disabled={pending}>
        <legend className="mb-3 font-semibold">Reporting</legend>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-interval`}>
            Expected reporting interval (seconds)
          </Label>
          <Input
            {...errorProps("interval")}
            id={`${id}-interval`}
            max={MAX_REPORTING_INTERVAL_SECONDS}
            min={1}
            name="interval"
            onChange={handleChange}
            required
            step={1}
            type="number"
            value={values.interval}
          />
          {errorText("interval")}
        </div>
      </fieldset>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
        <Button disabled={pending} type="submit">
          {pending ? "Registering…" : "Register device"}
        </Button>
      </div>
    </form>
  );
}
