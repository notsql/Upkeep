import { Badge } from "@proj/ui/components/badge";

/** Confirmed duplicates of a work order's source report, shown to signal urgency (ID-74). */
export function DuplicateCountBadge({ count }: { count?: number }) {
  if (!count) {
    return null;
  }
  return (
    <Badge variant="secondary">
      {count} {count === 1 ? "duplicate" : "duplicates"}
    </Badge>
  );
}
