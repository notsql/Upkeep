import { Card, CardContent, CardHeader } from "@proj/ui/components/card";
import { History } from "lucide-react";
import { SectionHeading } from "@/components/page/section-heading";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import type { useWorkOrderStatusHistory } from "@/lib/work-orders";

export function StatusHistory({
  history,
  onRetry,
}: {
  history: ReturnType<typeof useWorkOrderStatusHistory>;
  onRetry: () => unknown;
}) {
  return (
    <Card>
      <CardHeader>
        <SectionHeading icon={History}>Status history</SectionHeading>
      </CardHeader>
      <CardContent>
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
                <p>
                  {event.fromStatus
                    ? `${event.fromStatus.replaceAll("_", " ")} → `
                    : "Created · "}
                  {event.toStatus.replaceAll("_", " ")}
                </p>
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
      </CardContent>
    </Card>
  );
}
