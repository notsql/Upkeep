import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useCallback } from "react";
import { useEstateList } from "@/lib/estates";

export function EstateContextSwitcher({
  estateId,
  estateName,
}: {
  estateId: string;
  estateName?: string;
}) {
  const estates = useEstateList("ALL");
  const { refetch } = estates;
  const retry = useCallback(() => refetch(), [refetch]);
  const name =
    estateName ??
    estates.data?.find((estate) => estate.id === estateId)?.name ??
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
        <ChevronsUpDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="Switch estate"
        className="max-h-80 min-w-48 rounded-xl p-2"
      >
        {estates.isPending ? (
          <p className="p-2 text-muted-foreground text-sm" role="status">
            Loading estates…
          </p>
        ) : null}
        {estates.isError ? (
          <>
            <p className="p-2 text-muted-foreground text-sm" role="alert">
              Unable to load estates.
            </p>
            <DropdownMenuItem onClick={retry}>
              Retry loading estates
            </DropdownMenuItem>
          </>
        ) : null}
        {estates.isSuccess && !estates.data.length ? (
          <p className="p-2 text-muted-foreground text-sm">
            No accessible estates.
          </p>
        ) : null}
        {estates.isError
          ? null
          : estates.data?.map((estate) => (
              <DropdownMenuItem
                aria-label={`${estate.name} ${estate.code}${estate.deactivatedAt ? " Inactive" : ""}`}
                className="min-h-11 gap-3 rounded-lg text-sm"
                key={estate.id}
                render={
                  <Link
                    activeOptions={{ exact: true, includeSearch: false }}
                    aria-current={
                      estate.id === estateId ? "location" : undefined
                    }
                    hash=""
                    params={{ estateId: estate.id }}
                    search={{}}
                    to="/estates/$estateId"
                  />
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">
                    {estate.name}
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    {estate.code}
                    {estate.deactivatedAt ? " · Inactive" : ""}
                  </span>
                </span>
                {estate.id === estateId ? (
                  <Check aria-hidden="true" className="size-4 shrink-0" />
                ) : null}
              </DropdownMenuItem>
            ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
