import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { cn } from "@proj/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { FormPageHeader } from "@/components/page/form-page-header";
import type { Breadcrumb } from "@/components/page/page-header";
import { PageLayout } from "@/components/page/page-layout";

/**
 * The one shell for a create/edit page: a narrow (max-w-3xl) column with the
 * form page header, then the page's FormCards stacked with even spacing.
 */
export function FormPage({
  icon,
  breadcrumbs,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  breadcrumbs: Breadcrumb[];
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <PageLayout className="max-w-3xl">
      <FormPageHeader
        breadcrumbs={breadcrumbs}
        description={description}
        icon={icon}
        title={title}
      />
      <div className="grid gap-6">{children}</div>
    </PageLayout>
  );
}

/**
 * The bordered card every form (or form context block) sits in. With a
 * `title`, it is a labelled section with a header; without, just the card.
 */
export function FormCard({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  if (!title) {
    return (
      <Card className={className}>
        <CardContent>{children}</CardContent>
      </Card>
    );
  }
  return (
    <Card className={cn(className)}>
      <section aria-labelledby={headingId} className="contents">
        <CardHeader className="border-b">
          <CardTitle>
            <h2 className="text-base font-semibold" id={headingId}>
              {title}
            </h2>
          </CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </section>
    </Card>
  );
}
