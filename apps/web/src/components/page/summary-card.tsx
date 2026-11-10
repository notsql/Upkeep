import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { cn } from "@proj/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A dashboard count in a card, named by its title; its icon tile turns warning-toned when it needs attention. */
export function SummaryCard({
  title,
  value,
  icon: Icon,
  warning = false,
  children,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  warning?: boolean;
  children: ReactNode;
}) {
  return (
    <Card aria-label={title} className="h-full gap-3" role="region">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>
          <h2 className="text-sm">{title}</h2>
        </CardTitle>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            warning
              ? "bg-warning/10 text-warning"
              : "bg-brand-1/15 text-brand-3"
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}
