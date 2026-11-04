import { buttonVariants } from "@proj/ui/components/button";
import { cn } from "@proj/ui/lib/utils";
import {
  Link,
  type LinkComponentProps,
  type RegisteredRouter,
  type ValidateLinkOptions,
} from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The "Back to …" link at the top of a page, pointing at its nearest parent.
 * A quiet ghost button whose arrow lines up with the page title's left edge.
 */
export function BackLink<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
>({
  children,
  ...link
}: ValidateLinkOptions<TRouter, TOptions> & { children: ReactNode }) {
  return (
    <Link
      {...(link as LinkComponentProps)}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "text-muted-foreground hover:text-foreground mb-2 -ml-2.5 w-fit"
      )}
    >
      <ArrowLeft aria-hidden="true" />
      {children}
    </Link>
  );
}
