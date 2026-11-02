import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface Breadcrumb {
  label: string;
  params?: { estateId: string; assetId?: string };
  to?:
    | "/"
    | "/estates"
    | "/account"
    | "/admin/users"
    | "/estates/$estateId"
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
    <header className="page-header">
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumbs" className="mb-4">
            <ol className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
              {breadcrumbs.map((item, index) => (
                <li
                  className="flex min-w-0 items-center gap-2"
                  key={`${item.label}-${item.to ?? "current"}`}
                >
                  {index ? (
                    <ChevronRight aria-hidden="true" className="size-3" />
                  ) : null}
                  {item.to ? (
                    <Link
                      className="break-words hover:text-foreground hover:underline"
                      params={item.params}
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      aria-current="page"
                      className="break-words text-foreground"
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title break-words">{title}</h1>
          {status}
        </div>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
