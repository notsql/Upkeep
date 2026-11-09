import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useState } from "react";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useFlatlinePolicies } from "@/lib/flatlined-sensors";
import { MetricPolicySettings } from "@/routes/_auth/estates/$estateId/assets/devices/-components/metric-policy-settings/metric-policy-settings";

/** Policies load only once the dialog opens. */
function PolicyContent({ estateId }: { estateId: string }) {
  const policies = useFlatlinePolicies(estateId);
  const { refetch } = policies;
  const retry = useCallback(() => refetch(), [refetch]);
  if (policies.isPending) {
    return <LoadingState label="Loading metric policies…" rows={2} />;
  }
  if (policies.error) {
    return (
      <ErrorState
        message={policies.error.message}
        onRetry={retry}
        retryLabel="Retry metric policies"
      />
    );
  }
  return (
    <div className="grid gap-4">
      {policies.data.estateActive ? null : (
        <Alert>
          <AlertDescription>
            This estate is inactive. Metric policies remain available to view.
          </AlertDescription>
        </Alert>
      )}
      <MetricPolicySettings
        canManage={Boolean(
          policies.data.canManage && policies.data.estateActive
        )}
        defaultExpanded
        estateId={estateId}
        policies={policies.data.policies}
      />
    </div>
  );
}

export function MetricPoliciesDialog({ estateId }: { estateId: string }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return (
    <>
      <Button onClick={show} type="button" variant="outline">
        <SlidersHorizontal aria-hidden="true" />
        Metric policies
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Metric policies</DialogTitle>
            <DialogDescription>
              Estate-wide thresholds and tolerances for flatline detection
            </DialogDescription>
          </DialogHeader>
          {open ? <PolicyContent estateId={estateId} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
