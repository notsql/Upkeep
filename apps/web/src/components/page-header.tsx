import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbSeparator,
} from "@proj/ui/components/breadcrumb";
import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";

interface Breadcrumb {
  label: string;
  params?: { estateId: string; assetId?: string };
  search?: { estateId?: string };
  to?:
    | "/estates"
    | "/reports"
    | "/estates/$estateId/assets"
    | "/estates/$estateId/readings"
    | "/estates/$estateId/work-orders"
    | "/estates/$estateId/reports"
    | "/estates/$estateId/assets/$assetId";
}
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  status,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <BreadcrumbRoot aria-label="Breadcrumbs" className="mb-4">
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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold break-words">{title}</h1>
          {status}
        </div>
        {description ? (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
