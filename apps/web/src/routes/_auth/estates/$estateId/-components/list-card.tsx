import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";

export function ListCard({
  title,
  description,
  footer,
  empty,
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  footer: ReactNode;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <Card aria-label={title} role="region">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <Icon aria-hidden="true" className="text-muted-foreground size-4" />
            {title}
          </h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {empty ? (
          <EmptyState title="Nothing to show" />
        ) : (
          <ul className="divide-y">{children}</ul>
        )}
        <div className="text-sm">{footer}</div>
      </CardContent>
    </Card>
  );
}
