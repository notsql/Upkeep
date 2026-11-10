import { cn } from "@proj/ui/lib/utils";
import type { ComponentProps } from "react";

export function PageLayout({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-6xl px-3 py-4 md:px-8 md:py-8",
        className
      )}
      {...props}
    />
  );
}
