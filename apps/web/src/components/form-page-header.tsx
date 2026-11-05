import { type Breadcrumb, PageHeader } from "@/components/page-header";

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
