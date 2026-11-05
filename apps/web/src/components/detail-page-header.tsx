import type { ReactNode } from "react";
import { type Breadcrumb, PageHeader } from "@/components/page-header";

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
