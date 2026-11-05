import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@proj/ui/components/empty";
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one "nothing here" view: a dashed card with a message and, when the
 * user can create, the primary create action (or "Clear filters" when
 * filters caused the empty result).
 *
 * The icon defaults to the neutral `Inbox`. Do not pass the page's own icon
 * (it is already in the sidebar and header); pass `SearchX` only for a
 * "no matching results" state.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty className="bg-card border border-dashed" role="status">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
