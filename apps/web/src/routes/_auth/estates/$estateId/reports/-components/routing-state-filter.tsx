import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback, useId } from "react";
import { ROUTING_STATES, type RoutingState } from "@/lib/report-routing";

const ALL = "ALL";
const OPTIONS = [
  { value: ALL, label: "All routing states" },
  ...ROUTING_STATES,
];

export function RoutingStateFilter({
  value,
  onChange,
}: {
  value: RoutingState | undefined;
  onChange: (value: RoutingState | undefined) => void;
}) {
  const id = useId();
  const change = useCallback(
    (next: string | null) =>
      onChange(!next || next === ALL ? undefined : (next as RoutingState)),
    [onChange]
  );
  return (
    <div className="grid max-w-xs gap-2">
      <Label htmlFor={id}>Routing</Label>
      <Select items={OPTIONS} onValueChange={change} value={value ?? ALL}>
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
