import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@proj/ui/components/empty";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one "nothing here" view: a quiet bordered panel with a title, an
 * optional decorative `icon` in a brand-tinted tile, an optional muted
 * description and an optional recovery `action` ("Clear filters", "Go to
 * first page"). No create button - the page header's Create is the single
 * create entry point.
 *
 * Inside a Card's content it drops its border so it never reads as a
 * card-in-a-card.
 */
export function EmptyState({
  title,
  icon: Icon,
  description,
  action,
}: {
  title: string;
  icon?: LucideIcon;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty
      className="gap-3 rounded-lg border border-solid px-6 py-10 in-data-[slot=card-content]:border-0 in-data-[slot=card-content]:py-6"
      role="status"
    >
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia className="bg-brand-1/15 text-brand-2" variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
