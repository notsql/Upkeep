import { cn } from "@proj/ui/lib/utils";
import type { ReactNode } from "react";

/** A page's label/value details as a plain `dl` - no card around it. */
export function DetailList({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <dl
      className={cn(
        "[&_dt]:text-muted-foreground grid gap-3 sm:grid-cols-2 sm:gap-4 [&_dd]:text-base [&_dd]:font-medium [&_dd]:wrap-anywhere [&_dt]:mb-1 [&_dt]:text-sm [&_dt]:font-medium",
        className
      )}
    >
      {children}
    </dl>
  );
}
