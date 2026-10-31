import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import type { NavigationItem } from "@/components/app-navigation";

export function EstateSectionMenu({ items }: { items: NavigationItem[] }) {
  if (!items.length) {
    return null;
  }
  const current = items.find((item) => item.active);
  const Icon = current?.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Estate section: ${current?.label ?? "Choose section"}`}
            className="min-h-11 w-full justify-start gap-2 rounded-xl px-3"
            variant="outline"
          />
        }
      >
        {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate text-left">
          {current?.label ?? "Choose section"}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="Estate sections"
        className="max-h-[min(24rem,var(--available-height))] rounded-xl p-1"
      >
        {items.map((item) => {
          const ItemIcon = item.icon;
          return (
            <DropdownMenuItem
              className="min-h-11 gap-3 rounded-lg px-3 text-sm"
              key={item.label}
              render={
                <Link
                  activeOptions={{ exact: true, includeSearch: false }}
                  aria-current={item.active ? "page" : undefined}
                  params={{ estateId: item.estateId }}
                  search={item.search}
                  to={item.to}
                />
              }
            >
              <ItemIcon aria-hidden="true" className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.active ? (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
