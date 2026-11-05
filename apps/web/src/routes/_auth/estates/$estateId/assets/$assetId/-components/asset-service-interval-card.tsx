import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { History } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { ServiceIntervalDialog } from "@/components/service-interval-dialog";
import {
  type AssetServiceInterval,
  formatInterval,
  type ServiceInterval,
  useAssetServiceInterval,
  useSetAssetServiceInterval,
} from "@/lib/service-intervals";

const OVERRIDE_BADGE =
  "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";

/** The source badge and the sentence explaining where the interval comes from. */
function SourceBadge({ interval }: { interval: AssetServiceInterval }) {
  if (interval.source === "ASSET") {
    return (
      <Badge className={OVERRIDE_BADGE} variant="outline">
        Override
      </Badge>
    );
  }
  if (interval.source === "CATEGORY") {
    return <Badge variant="secondary">From category</Badge>;
  }
  return (
    <Badge className="text-muted-foreground" variant="outline">
      No interval
    </Badge>
  );
}

function explanation(interval: AssetServiceInterval): string {
  const label = interval.categoryLabel;
  if (interval.source === "ASSET") {
    return interval.categoryInterval
      ? `Replaces the ${label} interval (${formatInterval(interval.categoryInterval).toLowerCase()}).`
      : `The ${label} category has no interval.`;
  }
  if (interval.source === "CATEGORY") {
    return `Inherited from the ${label} category.`;
  }
  return `Neither this asset nor the ${label} category has an interval.`;
}

/** An asset's effective service interval and its override (ID-81). */
export function AssetServiceIntervalCard({
  estateId,
  assetId,
  locked,
}: {
  estateId: string;
  assetId: string;
  /** Why the override cannot be changed; unset when it can. */
  locked?: string;
}) {
  const headingId = useId();
  const interval = useAssetServiceInterval(estateId, assetId);
  const setOverride = useSetAssetServiceInterval(estateId, assetId);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const { mutateAsync } = setOverride;
  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => setEditing(false), []);
  const save = useCallback(
    async (next: ServiceInterval | null) => {
      await mutateAsync(next);
      setEditing(false);
      toast.success("Service interval updated.");
    },
    [mutateAsync]
  );
  const remove = useCallback(async () => {
    setError(undefined);
    try {
      await mutateAsync(null);
      toast.success("Override removed.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to remove override."
      );
    }
  }, [mutateAsync]);
  const { data } = interval;
  const change = data?.lastOverrideChange;
  const overridden = Boolean(data?.override);

  return (
    <section aria-labelledby={headingId} className="my-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id={headingId}>Service interval</h2>
          </CardTitle>
          <CardDescription>
            How often the manufacturer says this asset should be serviced.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {interval.isPending ? (
            <LoadingState label="Loading service interval…" rows={2} />
          ) : null}
          {interval.error ? (
            <Alert variant="destructive">
              <AlertDescription>{interval.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {data ? (
            <>
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-2xl font-semibold">
                    {formatInterval(data.effective)}
                  </p>
                  <SourceBadge interval={data} />
                </div>
                <p className="text-muted-foreground text-sm">
                  {explanation(data)}
                </p>
              </div>
              {change ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <History aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>
                    Override last changed by{" "}
                    {change.changedByName ?? "Unknown user"} ·{" "}
                    {new Date(change.changedAt).toLocaleString()}
                  </span>
                </p>
              ) : null}
              {locked ? (
                <p className="text-muted-foreground text-sm" role="note">
                  {locked}
                </p>
              ) : null}
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={Boolean(locked) || setOverride.isPending}
                  onClick={open}
                  variant="outline"
                >
                  {overridden ? "Edit override" : "Override"}
                </Button>
                {overridden ? (
                  <Button
                    disabled={Boolean(locked) || setOverride.isPending}
                    onClick={remove}
                    variant="outline"
                  >
                    Remove override
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
      {editing && data ? (
        <ServiceIntervalDialog
          description={`How often this asset should be serviced. It replaces the ${data.categoryLabel.toLowerCase()} interval for this asset only.`}
          interval={data.override ?? null}
          onCancel={close}
          onSave={save}
          title="Override service interval"
        />
      ) : null}
    </section>
  );
}
