import { buttonVariants } from "@proj/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@proj/ui/components/card";
import { useIsMobile } from "@proj/ui/hooks/use-mobile";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { SectionHeading } from "@/components/page/section-heading";

/**
 * The one look for a section header action: a small outline button whose
 * first child is an `aria-hidden` lucide icon, then the label. Pass to
 * `<Button {...SECTION_ACTION}>` or `buttonVariants(SECTION_ACTION)` on a Link.
 */
export const SECTION_ACTION = { size: "sm", variant: "outline" } as const;
export const sectionActionClassName = buttonVariants(SECTION_ACTION);

/**
 * A page section in a Card: SectionHeading title (labels the `section`),
 * optional description, optional header `actions` (top right; build each
 * with SECTION_ACTION and a leading icon), then content.
 * `icon` must differ from the page header's icon (or be omitted).
 */
export function SectionCard({
  title,
  icon,
  level = 2,
  description,
  actions,
  className,
  contentClassName,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  level?: 2 | 3 | 4;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const mobile = useIsMobile();
  return (
    <Card className={className} size={mobile ? "sm" : "default"}>
      <section aria-labelledby={headingId} className="contents">
        <CardHeader>
          <SectionHeading icon={icon} id={headingId} level={level}>
            {title}
          </SectionHeading>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
          {actions ? (
            <CardAction className="flex flex-wrap gap-2">{actions}</CardAction>
          ) : null}
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </section>
    </Card>
  );
}

/**
 * The same section header as SectionCard - heading, optional description and
 * actions - with the content straight on the page, for a tab whose only
 * content is one list or table (no card-in-card).
 */
export function PageSection({
  title,
  icon,
  level = 2,
  description,
  actions,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  level?: 2 | 3 | 4;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <SectionHeading icon={icon} id={headingId} level={level}>
            {title}
          </SectionHeading>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
