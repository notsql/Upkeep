import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@proj/ui/components/card";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { SectionHeading } from "@/components/page/section-heading";

/**
 * A page section in a Card: SectionHeading title (labels the `section`),
 * optional description, optional header `actions` (top right), then content.
 * `icon` must differ from the page header's icon (or be omitted).
 */
export function SectionCard({
  title,
  icon,
  level = 2,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  level?: 2 | 3 | 4;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Card className={className}>
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
        <CardContent>{children}</CardContent>
      </section>
    </Card>
  );
}
