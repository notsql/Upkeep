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
import { useAppAccess } from "@/lib/access";

export type EstateFeature = "work-orders" | "reports";
type EstateContextFeature = EstateFeature | "management" | "resident";
const roleLabels: Record<string, string> = {
  MANAGER: "Manager",
  CREW: "Crew",
  COUNCIL: "Council",
  MEMBER: "Member",
  RESIDENT: "Resident",
};

function estateRoleLabel(
  estate: components["schemas"]["EstateAccessResponse"]
): string {
  if (estate.role === "CUSTOM") {
    return estate.customRoleName ?? "Custom role";
  }
  return roleLabels[estate.role ?? ""] ?? "Role unavailable";
}

function estateDestination(
  estate: components["schemas"]["EstateAccessResponse"],
  feature: EstateContextFeature
) {
  if (estate.role === "RESIDENT") {
    return "/reports/new";
  }
  if (feature === "reports" && estate.canViewFaultReports) {
    return "/estates/$estateId/reports";
  }
  if (feature === "work-orders" && estate.canViewWorkOrders) {
    return "/estates/$estateId/work-orders";
  }
  if (estate.canViewManagement) {
    return "/estates/$estateId";
  }
  if (estate.canViewWorkOrders) {
    return "/estates/$estateId/work-orders";
  }
  if (estate.canViewFaultReports) {
    return "/estates/$estateId/reports";
  }
  if (estate.canViewEstateRoles) {
    return "/estates/$estateId/roles";
  }
  if (estate.canViewEstateInvitations) {
    return "/estates/$estateId/council";
  }
  return "/estates";
}

export function EstateFeatureSwitcher({
  estateId,
  estates,
  feature,
}: {
  feature: EstateContextFeature;
  estateId: string;
  estates: components["schemas"]["EstateAccessResponse"][];
}) {
  const access = useAppAccess();
  const choices = estates;
  const current = choices.find((estate) => estate.estateId === estateId);
  const name = current?.estateName ?? "Choose estate";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-description={current ? estateRoleLabel(current) : undefined}
            aria-label={`Switch estate: ${name}`}
            className="h-auto min-h-11 w-full justify-start gap-2 rounded-xl px-3 py-3"
            variant="outline"
          />
        }
      >
        <Building2 aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">{name}</span>
          {current ? (
            <span className="block text-muted-foreground text-xs">
              {estateRoleLabel(current)}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="Switch estate"
        className="max-h-[min(20rem,var(--available-height))] min-w-48 rounded-xl p-2"
      >
        {choices.map((estate) => {
          const resident = estate.role === "RESIDENT";
          const unavailable =
            resident &&
            !access.data?.residentEstates.some(
              (item) => item.id === estate.estateId
            );
          const destination = estateDestination(estate, feature);
          return (
            <DropdownMenuItem
              aria-label={estate.estateName}
              className="min-h-11 gap-3 rounded-lg text-sm"
              disabled={unavailable}
              key={estate.estateId}
              render={
                <Link
                  activeOptions={{ exact: true, includeSearch: false }}
                  aria-current={
                    estate.estateId === estateId ? "location" : undefined
                  }
                  hash=""
                  params={{ estateId: estate.estateId }}
                  search={resident ? { estateId: estate.estateId } : {}}
                  to={destination}
                />
              }
            >
              <span className="min-w-0 flex-1 break-words font-medium">
                <span className="block">{estate.estateName}</span>
                <span className="block font-normal text-muted-foreground text-xs">
                  {estateRoleLabel(estate)}
                  {unavailable ? " · Reporting unavailable" : ""}
                </span>
              </span>
              {estate.estateId === estateId ? (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
