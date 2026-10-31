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

export type EstateFeature =
  | "work-orders"
  | "reports"
  | "documents"
  | "resident-reports"
  | "report-creation";
type EstateContextFeature =
  | EstateFeature
  | "readings"
  | "management"
  | "resident";
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
    return feature === "report-creation" ? "/reports/new" : "/reports";
  }
  if (feature === "documents" && estate.canViewDocuments) {
    return "/estates/$estateId/documents";
  }
  if (feature === "readings" && estate.canViewReadings) {
    return "/estates/$estateId/readings";
  }
  if (feature === "reports" && estate.canViewFaultReports) {
    return "/estates/$estateId/reports";
  }
  if (feature === "work-orders" && estate.canViewWorkOrders) {
    return "/estates/$estateId/work-orders";
  }
  if (estate.canViewEstateDetails ?? estate.canViewManagement) {
    return "/estates/$estateId";
  }
  if (estate.canViewWorkOrders) {
    return "/estates/$estateId/work-orders";
  }
  if (estate.canViewFaultReports) {
    return "/estates/$estateId/reports";
  }
  if (estate.canViewDocuments) {
    return "/estates/$estateId/documents";
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
            className="h-auto min-h-11 w-full min-w-0 max-w-full justify-start gap-2 rounded-xl px-3 py-3"
            title={current ? `${name} (${estateRoleLabel(current)})` : name}
            variant="outline"
          />
        }
      >
        <Building2 aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">{name}</span>
          {current ? (
            <span className="block truncate text-muted-foreground text-xs">
              {estateRoleLabel(current)}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="Switch estate"
        className="max-h-[min(20rem,var(--available-height))] min-w-48 max-w-[min(24rem,var(--available-width))] rounded-xl p-2"
      >
        {choices.map((estate) => {
          const resident = estate.role === "RESIDENT";
          const reportingUnavailable =
            resident &&
            !access.data?.residentEstates.some(
              (item) => item.id === estate.estateId
            );
          const unavailable =
            feature === "report-creation" && reportingUnavailable;
          const destination = estateDestination(estate, feature);
          return (
            <DropdownMenuItem
              aria-description={
                resident
                  ? `Resident · ${feature === "report-creation" ? "Report a fault" : "My reports"}`
                  : estateRoleLabel(estate)
              }
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
              <span className="wrap-anywhere min-w-0 flex-1 whitespace-normal font-medium">
                <span className="block">{estate.estateName}</span>
                <span className="block font-normal text-muted-foreground text-xs">
                  <span>{estateRoleLabel(estate)}</span>
                  {resident ? (
                    <>
                      {" "}
                      ·{" "}
                      <span>
                        {feature === "report-creation"
                          ? "Report a fault"
                          : "My reports"}
                      </span>
                    </>
                  ) : null}
                  {reportingUnavailable ? " · Reporting unavailable" : ""}
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
