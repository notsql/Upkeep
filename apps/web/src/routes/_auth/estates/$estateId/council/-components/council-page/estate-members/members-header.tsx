import { Badge } from "@proj/ui/components/badge";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";

export function MembersHeader({ count }: { count: number | undefined }) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <h2>Members</h2>
        {count === undefined ? null : (
          <Badge variant="outline">{count} active</Badge>
        )}
      </CardTitle>
      <CardDescription>
        Each member has one role in this estate. The Owner is the Manager who
        holds ownership: only they can transfer ownership or deactivate the
        estate.
      </CardDescription>
    </CardHeader>
  );
}
