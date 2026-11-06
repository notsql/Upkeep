import { Badge } from "@proj/ui/components/badge";
import { Card } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin } from "lucide-react";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import { formatMcst, type useEstateList } from "@/lib/estates";

const monogramColours = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
];

function monogramColour(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return monogramColours[hash % monogramColours.length] ?? "";
}

const whitespace = /\s+/u;

type EstateSummary = NonNullable<
  ReturnType<typeof useEstateList>["data"]
>[number];

function initials(name: string): string {
  const words = name.trim().split(whitespace).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function EstateCard({ estate }: { estate: EstateSummary }) {
  return (
    <Link
      aria-label={`${estate.name} (${formatMcst(estate.code)})`}
      className="group focus-visible:ring-ring block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      params={{ estateId: estate.id }}
      to="/estates/$estateId"
    >
      <Card className="group-hover:ring-primary/40 group-focus-visible:ring-primary/40 h-full gap-4 px-5 text-sm transition-[box-shadow] group-hover:shadow-md motion-reduce:transition-none">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${monogramColour(estate.id)}`}
          >
            {initials(estate.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold tracking-tight">
              {estate.name}
            </h2>
            <p className="text-muted-foreground font-mono text-xs">
              {formatMcst(estate.code)}
            </p>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          />
        </div>
        <p className="text-muted-foreground flex min-w-0 items-start gap-1.5">
          <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-2">
            {estate.address}, {estate.postalCode}
          </span>
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          <Badge variant={estate.owned ? "secondary" : "outline"}>
            {estate.owned ? "Owner" : "Shared with you"}
          </Badge>
          <LifecycleStatusBadge
            inactive={Boolean(estate.deactivatedAt)}
            inactiveLabel="Inactive"
          />
        </div>
      </Card>
    </Link>
  );
}
