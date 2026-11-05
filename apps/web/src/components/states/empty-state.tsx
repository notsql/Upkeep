import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@proj/ui/components/empty";
import type { ReactNode } from "react";

/**
 * The one "nothing here" view: a quiet bordered panel with a title, an
 * optional muted description and an optional recovery `action` ("Clear
 * filters", "Go to first page"). No icon, and no create button - the page
 * header's Create is the single create entry point.
 *
 * Inside a Card's content it drops its border so it never reads as a
 * card-in-a-card.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty
      className="gap-3 rounded-lg border border-solid px-6 py-10 in-data-[slot=card-content]:border-0 in-data-[slot=card-content]:py-6"
      role="status"
    >
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
