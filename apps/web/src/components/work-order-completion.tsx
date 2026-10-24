import type { WorkOrderCompletion } from "@/lib/work-orders";
export function CompletionOutcome({
  completion,
}: {
  completion: WorkOrderCompletion;
}) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="font-medium">Findings</dt>
          <dd className="whitespace-pre-wrap break-words">
            {completion.findings}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium">Work performed</dt>
          <dd className="whitespace-pre-wrap break-words">
            {completion.workPerformed}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium">Parts used</dt>
          <dd className="whitespace-pre-wrap break-words">
            {completion.partsUsed ?? "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Labour cost (SGD)</dt>
          <dd>{completion.labourCost ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Parts cost (SGD)</dt>
          <dd>{completion.partsCost ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Total cost (SGD)</dt>
          <dd>{completion.totalCost ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Downtime (minutes)</dt>
          <dd>{completion.downtimeMinutes ?? "Unknown"}</dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        Completed by {completion.completedByName ?? "Name unavailable"} ·{" "}
        <time dateTime={completion.completedAt}>
          {new Date(completion.completedAt).toLocaleString()}
        </time>
      </p>
      {completion.editedAt ? (
        <p className="text-muted-foreground text-sm">
          Edited by {completion.editedByName ?? "Name unavailable"} ·{" "}
          <time dateTime={completion.editedAt}>
            {new Date(completion.editedAt).toLocaleString()}
          </time>
        </p>
      ) : null}
    </div>
  );
}
