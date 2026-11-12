import { History } from "lucide-react";
import { PageSection } from "@/components/page/section-card";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import type { useWorkOrderStatusHistory } from "@/lib/work-orders";

type StatusEvent = NonNullable<
  ReturnType<typeof useWorkOrderStatusHistory>["data"]
>[number];

function describe(event: StatusEvent): string {
  if (event.kind === "ASSIGNED") {
    return `Assigned to ${event.assigneeName ?? "someone"}`;
  }
  if (event.kind === "UNASSIGNED") {
    return "Unassigned";
  }
  return `${
    event.fromStatus
      ? `${event.fromStatus.replaceAll("_", " ")} → `
      : "Created · "
  }${event.toStatus.replaceAll("_", " ")}`;
}

export function StatusHistory({
  history,
  onRetry,
}: {
  history: ReturnType<typeof useWorkOrderStatusHistory>;
  onRetry: () => unknown;
}) {
  return (
    <PageSection icon={History} title="Status history">
      {history.isPending ? (
        <LoadingState label="Loading status history…" rows={2} />
      ) : null}
      {history.isError ? (
        <ErrorState
          message="Couldn't load status history. Try again."
          onRetry={onRetry}
          retryLabel="Retry history"
        />
      ) : null}
      {!history.isError && history.data ? (
        <ol className="space-y-4">
          {history.data.map((event) => (
            <li key={event.id}>
              <p>{describe(event)}</p>
              <p className="text-muted-foreground">
                {event.changedByName ?? "Name unavailable"} ·{" "}
                <time dateTime={event.changedAt}>
                  {new Date(event.changedAt).toLocaleString()}
                </time>
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </PageSection>
  );
}
