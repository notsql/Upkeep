import { Card, CardContent } from "@proj/ui/components/card";
import type { ReactNode } from "react";

export function DetailCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardContent>
        <dl className="[&_dt]:text-muted-foreground grid gap-4 sm:grid-cols-2 [&_dd]:text-base [&_dd]:font-medium [&_dd]:wrap-anywhere [&_dt]:mb-1 [&_dt]:text-sm [&_dt]:font-medium">
          {children}
        </dl>
      </CardContent>
    </Card>
  );
}
