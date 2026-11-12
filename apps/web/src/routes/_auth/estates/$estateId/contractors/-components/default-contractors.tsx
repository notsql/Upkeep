import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Settings2 } from "lucide-react";
import { useCallback, useId } from "react";
import { PageSection } from "@/components/page/section-card";
import { type Contractor, useSetDefaultContractor } from "@/lib/contractors";
import { EQUIPMENT_TYPES, type EquipmentType } from "@/lib/report-routing";

const NOBODY = "none";

const PLURALS: Record<EquipmentType, string> = {
  PUMP: "pumps",
  LIFT: "lifts",
  GATE: "gates",
  LIGHT: "common-area lights",
  PLUMBING: "plumbing",
};

function DefaultSelect({
  estateId,
  type,
  contractors,
}: {
  estateId: string;
  type: EquipmentType;
  contractors: Contractor[];
}) {
  const id = useId();
  const save = useSetDefaultContractor(estateId, type);
  const current =
    contractors.find((contractor) => contractor.defaultFor.includes(type))
      ?.id ?? NOBODY;
  const items = [
    { value: NOBODY, label: "Nobody (we'll review them)" },
    ...contractors.map((contractor) => ({
      value: contractor.id,
      label: contractor.name,
    })),
  ];
  const choose = useCallback(
    (value: string | null) => {
      if (value && value !== current) {
        save.mutate(value === NOBODY ? null : value);
      }
    },
    [current, save]
  );
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        Send new water-leak reports for {PLURALS[type]} to...
      </Label>
      <Select
        disabled={save.isPending}
        items={items}
        onValueChange={choose}
        value={current}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {save.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>{save.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

/** One default contractor per kind of equipment, used when water-leak reports are sent on automatically. */
export function DefaultContractors({
  estateId,
  contractors,
}: {
  estateId: string;
  contractors: Contractor[];
}) {
  return (
    <PageSection
      description="When a resident reports a water leak, we can send the job straight to one of your contractors."
      icon={Settings2}
      title="Default contractors"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {EQUIPMENT_TYPES.map((type) => (
          <DefaultSelect
            contractors={contractors}
            estateId={estateId}
            key={type.value}
            type={type.value}
          />
        ))}
      </div>
    </PageSection>
  );
}
