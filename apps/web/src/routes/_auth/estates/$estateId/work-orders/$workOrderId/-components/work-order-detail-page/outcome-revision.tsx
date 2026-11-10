import { Button } from "@proj/ui/components/button";
import { useCallback, useId, useState } from "react";
import { CompletionOutcome } from "@/components/work-orders/work-order-completion";
import type { WorkOrderCompletionRevision } from "@/lib/work-orders";

export function OutcomeRevision({
  revision,
}: {
  revision: WorkOrderCompletionRevision;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((value) => !value), []);
  const id = useId();
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="font-medium break-words whitespace-pre-wrap">
        {revision.correctionReason}
      </p>
      <p className="text-muted-foreground">
        {revision.changedByName ?? "Name unavailable"} ·{" "}
        <time dateTime={revision.changedAt}>
          {new Date(revision.changedAt).toLocaleString()}
        </time>
      </p>
      <Button
        aria-controls={id}
        aria-expanded={expanded}
        onClick={toggle}
        variant="outline"
      >
        {expanded ? "Hide before and after" : "View before and after"}
      </Button>
      {expanded ? (
        <div className="grid gap-6 lg:grid-cols-2" id={id}>
          <section aria-label="Before the change">
            <h3 className="mb-3 font-medium">Before the change</h3>
            <CompletionOutcome completion={revision.before} />
          </section>
          <section aria-label="After the change">
            <h3 className="mb-3 font-medium">After the change</h3>
            <CompletionOutcome completion={revision.after} />
          </section>
        </div>
      ) : null}
    </div>
  );
}
