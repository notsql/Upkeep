import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@proj/ui/components/field";
import { Switch } from "@proj/ui/components/switch";
import { type SubmitEvent, useCallback, useId, useState } from "react";
import {
  type NotificationSettings,
  useSaveNotificationSettings,
} from "@/lib/notifications";

type SwitchName = keyof NotificationSettings;

const SWITCHES: { name: SwitchName; label: string; help: string }[] = [
  {
    name: "anomalyEnabled",
    label: "Unusual readings",
    help: "Tell us when a sensor shows something out of the ordinary.",
  },
  {
    name: "serviceDueEnabled",
    label: "Service due",
    help: "Remind us 90, 60, 30 and 14 days before a service is due.",
  },
  {
    name: "repairPredictedEnabled",
    label: "Expected repair",
    help: "Warn us when something is likely to need repair in the next 90, 60 or 30 days.",
  },
  {
    name: "checkRequestedEnabled",
    label: "Check requested",
    help: "Tell a staff member when they are asked to check something.",
  },
  {
    name: "checkFailedEnabled",
    label: "Check failed",
    help: "Tell managers when a check finds a problem.",
  },
  {
    name: "workOrderAssignedEnabled",
    label: "Work order assigned",
    help: "Tell a staff member when a job is given to them.",
  },
];

function SettingSwitch({
  name,
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  name: SwitchName;
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onChange: (name: SwitchName, checked: boolean) => void;
}) {
  const id = useId();
  const change = useCallback(
    (next: boolean) => onChange(name, next),
    [name, onChange]
  );
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id} id={`${id}-label`}>
          {label}
        </FieldLabel>
        <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
      </FieldContent>
      <Switch
        aria-describedby={`${id}-help`}
        aria-labelledby={`${id}-label`}
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={change}
      />
    </Field>
  );
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
  const save = useSaveNotificationSettings(estateId);
  const { mutateAsync } = save;
  const [switches, setSwitches] = useState<NotificationSettings>(settings);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const change = useCallback((name: SwitchName, checked: boolean) => {
    setSwitches((current) => ({ ...current, [name]: checked }));
    setSaved(false);
  }, []);

  const submit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(undefined);
      setSaved(false);
      try {
        await mutateAsync(switches);
        setSaved(true);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't save the settings. Try again."
        );
      }
    },
    [mutateAsync, switches]
  );

  const disabled = inactive || save.isPending;

  return (
    <form className="grid gap-6" noValidate onSubmit={submit}>
      {inactive ? (
        <Alert variant="warning">
          <AlertDescription>
            This estate is inactive, so you can't change these settings.
          </AlertDescription>
        </Alert>
      ) : null}
      <p className="text-muted-foreground text-sm">
        Choose which messages this estate's team gets. All are on to start with.
      </p>
      <FieldGroup>
        {SWITCHES.map((item) => (
          <SettingSwitch
            checked={switches[item.name]}
            disabled={disabled}
            help={item.help}
            key={item.name}
            label={item.label}
            name={item.name}
            onChange={change}
          />
        ))}
      </FieldGroup>
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
  );
}
