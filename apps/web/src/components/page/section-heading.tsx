import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A section or card title with an optional lucide icon. Defaults to an h2;
 * pass `level` to keep the page's heading order.
 */
export function SectionHeading({
  icon: Icon,
  level = 2,
  id,
  className,
  children,
}: {
  icon?: LucideIcon;
  level?: 2 | 3 | 4;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      className={`flex items-center gap-2 text-lg font-semibold ${className ?? ""}`}
      id={id}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="text-brand-2 size-5 shrink-0" />
      ) : null}
      {children}
    </Tag>
  );
}
