import { Button } from "@proj/ui/components/button";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import type { AssociationDialogState } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-work-order-dialog/use-document-work-order-dialog";

export function AssociationHistory({
  state,
}: {
  state: AssociationDialogState;
}) {
  const { history, historyCursor, retryHistory, firstHistory, nextHistory } =
    state;
  return (
    <section aria-label="Association history" className="space-y-3">
      <h3 className="font-medium">Association history</h3>
      {history.isPending ? (
        <LoadingState label="Loading association history…" rows={2} />
      ) : null}
      {history.isError ? (
        <ErrorState
          message="Unable to load association history"
          onRetry={retryHistory}
          retryLabel="Retry history"
        />
      ) : null}
      {!history.isError && history.data?.items.length === 0 ? (
        <p>No association changes recorded.</p>
      ) : null}
      {!history.isError && history.data?.items.length ? (
        <ol className="space-y-3">
          {history.data.items.map((event) => (
            <li className="space-y-1 break-words" key={event.id}>
              <p>
                {event.fromWorkOrderReference ?? "Unlinked"} →{" "}
                {event.toWorkOrderReference ?? "Unlinked"}
              </p>
              {event.correctionReason ? (
                <p className="whitespace-pre-wrap">{event.correctionReason}</p>
              ) : null}
              <p className="text-muted-foreground text-sm">
                {event.changedByName ?? "Name unavailable"} ·{" "}
                {new Date(event.changedAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {historyCursor ? (
          <Button onClick={firstHistory} type="button" variant="outline">
            First history page
          </Button>
        ) : null}
        {history.data?.nextCursor ? (
          <Button onClick={nextHistory} type="button" variant="outline">
            Next history page
          </Button>
        ) : null}
      </div>
    </section>
  );
}
