import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

export type EstateFeature = "work-orders" | "reports";

export function EstateFeatureSwitcher({
  estateId,
  estates,
  feature,
}: {
  feature: EstateFeature;
  estateId: string;
  estates: components["schemas"]["EstateAccessResponse"][];
}) {
  const report = feature === "reports";
  const destination = report
    ? "/estates/$estateId/reports"
    : "/estates/$estateId/work-orders";
  const choices = estates.filter((estate) =>
    report ? estate.canViewFaultReports : estate.canViewWorkOrders
  );
  const name =
    choices.find((estate) => estate.estateId === estateId)?.estateName ??
    "Current estate";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Switch estate: ${name}`}
            className="h-auto min-h-11 w-full justify-start gap-2 rounded-xl px-3 py-3"
            variant="outline"
          />
        }
      >
        <Building2 aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{name}</span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="Switch estate"
        className="max-h-80 min-w-48 rounded-xl p-2"
      >
        {choices.map((estate) => (
          <DropdownMenuItem
            className="min-h-11 gap-3 rounded-lg text-sm"
            key={estate.estateId}
            render={
              <Link
                aria-current={
                  estate.estateId === estateId ? "location" : undefined
                }
                params={{ estateId: estate.estateId }}
                search={{}}
                to={destination}
              />
            }
          >
            <span className="min-w-0 flex-1 break-words font-medium">
              {estate.estateName}
              {report && !estate.canRelocateFaultReports ? " (Inactive)" : ""}
            </span>
            {estate.estateId === estateId ? (
              <Check aria-hidden="true" className="size-4 shrink-0" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
