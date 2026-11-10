import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  FilterToggle,
  type FilterToggleProps,
} from "@/components/filters/filter-toggle";
import {
  CreateButton,
  type CreateButtonProps,
} from "@/components/page/page-actions";
import { PageHeader } from "@/components/page/page-header";

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
  inlineActions,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  filters?: FilterToggleProps;
  create?: CreateButtonProps;
  actions?: ReactNode;
  /** Keep the actions on the title's row (icon-only actions only). */
  inlineActions?: boolean;
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
      inlineActions={inlineActions}
      title={title}
    />
  );
}
