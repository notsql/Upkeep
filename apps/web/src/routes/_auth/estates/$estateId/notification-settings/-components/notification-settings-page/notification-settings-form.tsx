import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
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
  useState,
} from "react";
import {
  type NotificationSettings,
  useSaveNotificationSettings,
} from "@/lib/notifications";

const THRESHOLD = /^(?:0\.\d{1,2}|1(?:\.0{1,2})?)$/u;
const WHOLE_NUMBER = /^\d+$/u;
const MIN_THRESHOLD = 0.51;
const MAX_LEAD_DAYS = 365;
const REPAIR_LEADS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

function parseThreshold(value: string): number | undefined {
  const trimmed = value.trim();
  if (!THRESHOLD.test(trimmed)) {
    return;
  }
  const number = Number(trimmed);
  return number >= MIN_THRESHOLD ? number : undefined;
}

function parseLeadDays(value: string): number | undefined {
  const trimmed = value.trim();
  if (!WHOLE_NUMBER.test(trimmed)) {
    return;
  }
  const number = Number(trimmed);
  return number <= MAX_LEAD_DAYS ? number : undefined;
}

function invalidProps(invalid: boolean, errorId: string) {
  return invalid ? { "aria-describedby": errorId, "aria-invalid": true } : {};
}

export function NotificationSettingsForm({
  estateId,
  settings,
  inactive,
}: {
  estateId: string;
  settings: NotificationSettings;
  inactive: boolean;
}) {
  const id = useId();
  const save = useSaveNotificationSettings(estateId);
  const { mutateAsync } = save;
  const [threshold, setThreshold] = useState(
    settings.anomalyScoreThreshold.toFixed(2)
  );
  const [leadDays, setLeadDays] = useState(String(settings.serviceLeadDays));
  const [repairLead, setRepairLead] = useState(String(settings.repairLeadDays));
  const [invalid, setInvalid] = useState({ threshold: false, lead: false });
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const changeThreshold = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setThreshold(event.target.value);
      setSaved(false);
    },
    []
  );
  const changeLeadDays = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setLeadDays(event.target.value);
    setSaved(false);
  }, []);
  const changeRepairLead = useCallback((next: string | null) => {
    if (next) {
      setRepairLead(next);
      setSaved(false);
    }
  }, []);

  const submit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const anomalyScoreThreshold = parseThreshold(threshold);
      const serviceLeadDays = parseLeadDays(leadDays);
      setInvalid({
        threshold: anomalyScoreThreshold === undefined,
        lead: serviceLeadDays === undefined,
      });
      if (
        anomalyScoreThreshold === undefined ||
        serviceLeadDays === undefined
      ) {
        return;
      }
      setError(undefined);
      setSaved(false);
      try {
        await mutateAsync({
          anomalyScoreThreshold,
          serviceLeadDays,
          repairLeadDays: Number(repairLead),
        });
        setSaved(true);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to save the settings. Please try again."
        );
      }
    },
    [leadDays, mutateAsync, repairLead, threshold]
  );

  const disabled = inactive || save.isPending;

  return (
    <Card>
      <CardContent>
        <form className="grid gap-6" noValidate onSubmit={submit}>
          {inactive ? (
            <Alert variant="warning">
              <AlertDescription>
                This estate is inactive, so its notification settings cannot be
                changed.
              </AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor={`${id}-threshold`}>
              Anomaly score threshold
            </FieldLabel>
            <Input
              disabled={disabled}
              id={`${id}-threshold`}
              inputMode="decimal"
              max={1}
              min={MIN_THRESHOLD}
              onChange={changeThreshold}
              step={0.01}
              type="number"
              value={threshold}
              {...invalidProps(invalid.threshold, `${id}-threshold-error`)}
            />
            <FieldDescription>
              Notify when an abnormal run's median score reaches this value.
              0.51 notifies on every abnormal run.
            </FieldDescription>
            {invalid.threshold ? (
              <FieldError id={`${id}-threshold-error`}>
                Enter a threshold from 0.51 to 1.00.
              </FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-lead`}>
              Service reminder lead time (days)
            </FieldLabel>
            <Input
              disabled={disabled}
              id={`${id}-lead`}
              inputMode="numeric"
              max={MAX_LEAD_DAYS}
              min={0}
              onChange={changeLeadDays}
              step={1}
              type="number"
              value={leadDays}
              {...invalidProps(invalid.lead, `${id}-lead-error`)}
            />
            <FieldDescription>
              Notify this many days before a service interval comes due.
            </FieldDescription>
            {invalid.lead ? (
              <FieldError id={`${id}-lead-error`}>
                Enter a whole number of days from 0 to 365.
              </FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-repair`}>
              Repair prediction lead time
            </FieldLabel>
            <Select
              disabled={disabled}
              items={REPAIR_LEADS}
              onValueChange={changeRepairLead}
              value={repairLead}
            >
              <SelectTrigger className="w-full" id={`${id}-repair`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPAIR_LEADS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Notify when a pump's breakdown forecast falls within this window.
            </FieldDescription>
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex items-center gap-3">
            <Button disabled={disabled} type="submit">
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
            {saved ? (
              <p className="text-muted-foreground text-sm" role="status">
                Settings saved.
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
