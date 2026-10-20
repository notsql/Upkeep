import type { components } from "@proj/api/schema";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useId } from "react";

export function ReportEstateSwitcher({
  estateId,
  estates,
}: {
  estateId: string;
  estates: components["schemas"]["EstateAccessResponse"][];
}) {
  const id = useId();
  const navigate = useNavigate();
  const change = useCallback(
    (value: string | null) => {
      if (value) {
        navigate({
          to: "/estates/$estateId/reports",
          params: { estateId: value },
          search: {},
        });
      }
    },
    [navigate]
  );
  const choices = estates
    .filter((estate) => estate.canViewFaultReports)
    .map((estate) => ({
      value: estate.estateId,
      label: `${estate.estateName}${estate.canRelocateFaultReports ? "" : " (Inactive)"}`,
    }));
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>Report estate</Label>
      <Select items={choices} onValueChange={change} value={estateId}>
        <SelectTrigger className="min-h-11 w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
