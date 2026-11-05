import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
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
        <CardTitle>
          <h2>Status history</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.isPending ? (
          <LoadingState label="Loading status history…" rows={2} />
        ) : null}
        {history.isError ? (
          <ErrorState
            message="Unable to load status history"
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
