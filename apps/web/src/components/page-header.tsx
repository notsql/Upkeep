import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbSeparator,
} from "@proj/ui/components/breadcrumb";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import {
  CreateButton,
  type CreateButtonProps,
  FilterToggle,
  type FilterToggleProps,
} from "@/components/page-actions";

export interface Breadcrumb {
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
    | "/estates/$estateId/roles"
    | "/estates/$estateId/council"
    | "/estates/$estateId/locations"
    | "/estates/$estateId/devices"
    | "/estates/$estateId/sensors"
    | "/estates/$estateId/documents"
    | "/estates/$estateId/inspections"
    | "/estates/$estateId/failure-risk"
    | "/estates/$estateId/asset-categories"
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
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** A muted one-line summary under the title (detail pages). */
  meta?: ReactNode;
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
          {Icon ? (
            <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon aria-hidden="true" className="size-5" />
            </span>
          ) : null}
          <h1 className="text-3xl font-semibold break-words">{title}</h1>
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
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * Header for a list page: icon, title, short description, then the shared
 * actions in fixed order - FilterToggle (given `filters`), extra `actions`,
 * CreateButton (given `create`). No breadcrumbs: list pages are top-level.
 */
export function ListPageHeader({
  icon,
  title,
  description,
  filters,
  create,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  filters?: FilterToggleProps;
  create?: CreateButtonProps;
  actions?: ReactNode;
}) {
  const hasActions = Boolean(filters || create || actions);
  return (
    <PageHeader
      actions={
        hasActions ? (
          <>
            {filters ? <FilterToggle {...filters} /> : null}
            {actions}
            {create ? <CreateButton {...create} /> : null}
          </>
        ) : undefined
      }
      description={description}
      icon={icon}
      title={title}
    />
  );
}

/**
 * Header for a record page: breadcrumbs (the way back), title, `status`
 * badge, a muted `meta` line, and `actions` (outline Edit, then a
 * destructive action last).
 */
export function DetailPageHeader({
  breadcrumbs,
  title,
  status,
  meta,
  actions,
}: {
  breadcrumbs: Breadcrumb[];
  title: string;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      actions={actions}
      breadcrumbs={breadcrumbs}
      meta={meta}
      status={status}
      title={title}
    />
  );
}

/**
 * Header for a create/edit page: breadcrumbs (the way back), title and an
 * optional description. No actions - the form's own footer submits.
 */
export function FormPageHeader({
  breadcrumbs,
  title,
  description,
}: {
  breadcrumbs: Breadcrumb[];
  title: string;
  description?: string;
}) {
  return (
    <PageHeader
      breadcrumbs={breadcrumbs}
      description={description}
      title={title}
    />
  );
}
