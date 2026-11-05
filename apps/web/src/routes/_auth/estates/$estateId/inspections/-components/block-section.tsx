import { useId } from "react";
import type { InspectionCheck } from "@/lib/inspection-list";
import { CheckTable } from "@/routes/_auth/estates/$estateId/inspections/-components/check-table";

interface Group {
  checks: InspectionCheck[];
  key: string;
  level: string;
}

export interface Block {
  groups: Group[];
  id: string;
  name: string;
}

export function BlockSection({
  block,
  estateId,
  canRecord,
}: {
  block: Block;
  estateId: string;
  canRecord: boolean;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <h2 className="text-lg font-semibold" id={headingId}>
        {block.name}
      </h2>
      {block.groups.map((group) => (
        <section
          aria-label={`${block.name}, ${group.level}`}
          className="grid gap-2"
          key={group.key}
        >
          <h3 className="text-muted-foreground text-sm font-medium">
            {group.level}
          </h3>
          <CheckTable
            canRecord={canRecord}
            checks={group.checks}
            estateId={estateId}
          />
        </section>
      ))}
    </section>
  );
}
