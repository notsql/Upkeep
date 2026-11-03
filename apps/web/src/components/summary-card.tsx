import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { cn } from "@proj/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A dashboard count in a card, named by its title; amber when it needs attention. */
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
    <Card
      aria-label={title}
      className={cn(
        "h-full gap-3",
        warning &&
          "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
      )}
      role="region"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>
          <h2 className="text-sm">{title}</h2>
        </CardTitle>
        <Icon
          aria-hidden="true"
          className={cn(
            "size-5 shrink-0",
            warning
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted-foreground"
          )}
        />
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}
