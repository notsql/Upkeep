import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbSeparator,
} from "@proj/ui/components/breadcrumb";
import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

export interface Breadcrumb {
  label: string;
  params?: { estateId: string; assetId?: string };
  search?: { estateId?: string };
  to?:
    | "/estates"
    | "/reports"
    | "/estates/$estateId/assets"
    | "/estates/$estateId/readings"
    | "/estates/$estateId/readings/imports"
    | "/estates/$estateId/work-orders"
    | "/estates/$estateId/reports"
    | "/estates/$estateId/roles"
    | "/estates/$estateId/council"
    | "/estates/$estateId/locations"
    | "/estates/$estateId/documents"
    | "/estates/$estateId/inspections"
    | "/estates/$estateId/inspections/schedules"
    | "/estates/$estateId/assets/$assetId";
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  breadcrumbs,
  actions,
  status,
  meta,
  inlineActions,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** A muted one-line summary under the title (detail pages). */
  meta?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  status?: ReactNode;
  /** Keep the actions on the title's row instead of wrapping below it. */
  inlineActions?: boolean;
}) {
  return (
    <header
      className={cn(
        "mb-4 flex items-start",
        inlineActions ? "flex-nowrap" : "flex-wrap",
        "justify-between gap-2 md:mb-5 md:gap-3"
      )}
    >
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <BreadcrumbRoot aria-label="Breadcrumbs" className="mb-3 md:mb-4">
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => (
                <Fragment key={`${item.label}-${item.to ?? "current"}`}>
                  {index ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem className="min-w-0 break-words">
                    {item.to ? (
                      <BreadcrumbLink
                        render={
                          <Link
                            params={item.params}
                            search={item.search}
                            to={item.to}
                          />
                        }
                      >
                        {item.label}
                      </BreadcrumbLink>
                    ) : (
                      // Not BreadcrumbPage: it sets role="link", and the current page is not a link.
                      <span aria-current="page" className="text-foreground">
                        {item.label}
                      </span>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </BreadcrumbRoot>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {Icon ? (
            <span className="bg-brand-1/15 text-brand-3 flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon aria-hidden="true" className="size-5" />
            </span>
          ) : null}
          <h1 className="text-2xl font-semibold break-words md:text-3xl">
            {title}
          </h1>
          {status}
        </div>
        {meta ? (
          <p className="text-muted-foreground mt-2 text-sm">{meta}</p>
        ) : null}
        {description ? (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div
          className={cn(
            "flex items-center gap-2 md:gap-3",
            inlineActions ? "shrink-0" : "flex-wrap"
          )}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
