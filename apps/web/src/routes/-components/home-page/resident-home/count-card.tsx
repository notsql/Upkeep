import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import type { LucideIcon } from "lucide-react";

export function CountCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <Card aria-label={label} role="region">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
        <span
          aria-hidden="true"
          className="bg-brand-1/15 text-brand-3 flex size-9 shrink-0 items-center justify-center rounded-lg"
        >
          <Icon className="size-5" />
        </span>
      </CardHeader>
      <CardContent className="text-3xl font-semibold">{value}</CardContent>
    </Card>
  );
}
