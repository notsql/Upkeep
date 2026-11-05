import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronsUpDown,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { useAppAccess } from "@/lib/access";
import {
  type EstateFeature,
  estateDestination,
} from "@/lib/estate-destinations";

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

export function EstateFeatureSwitcher({
  estateId,
  estates,
  feature,
}: {
  feature: EstateFeature;
  estateId: string | undefined;
  estates: components["schemas"]["EstateAccessResponse"][];
}) {
  const access = useAppAccess();
  const choices = estates;
  const current = choices.find((estate) => estate.estateId === estateId);
  const name = current?.estateName ?? "Select estate";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-description={current ? estateRoleLabel(current) : undefined}
            aria-label={`Switch estate: ${name}`}
            className="h-auto min-h-9 max-w-full min-w-0 justify-start gap-2 px-2 py-1"
            disabled={!access.data}
            title={current ? `${name} (${estateRoleLabel(current)})` : name}
            variant="ghost"
          />
        }
      >
        <Building2 aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 text-left">
          <span className="block truncate">{name}</span>
          {current ? (
            <span className="text-muted-foreground block truncate text-xs">
              {estateRoleLabel(current)}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="Switch estate"
        className="max-h-[min(20rem,var(--available-height))] max-w-[min(24rem,var(--available-width))] min-w-48 rounded-xl p-2"
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
              <span className="min-w-0 flex-1 font-medium wrap-anywhere whitespace-normal">
                <span className="block">{estate.estateName}</span>
                <span className="text-muted-foreground block text-xs font-normal">
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11 gap-3 rounded-lg text-sm"
          render={<Link to="/estates" />}
        >
          <LayoutGrid aria-hidden="true" />
          All estates
        </DropdownMenuItem>
        {access.data?.canCreateEstate ? (
          <DropdownMenuItem
            className="min-h-11 gap-3 rounded-lg text-sm"
            render={<Link to="/estates/new" />}
          >
            <Plus aria-hidden="true" />
            Create estate
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
