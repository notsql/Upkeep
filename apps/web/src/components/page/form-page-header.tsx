import type { LucideIcon } from "lucide-react";
import { type Breadcrumb, PageHeader } from "@/components/page/page-header";

/**
 * Header for a create/edit page: breadcrumbs (the way back), title and an
 * optional description. No actions - the form's own footer submits.
 */
export function FormPageHeader({
  icon,
  breadcrumbs,
  title,
  description,
}: {
  icon?: LucideIcon;
  breadcrumbs: Breadcrumb[];
  title: string;
  description?: string;
}) {
  return (
    <PageHeader
      breadcrumbs={breadcrumbs}
      description={description}
      icon={icon}
      title={title}
    />
  );
}
