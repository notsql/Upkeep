import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { SensorPolicy } from "@/lib/flatlined-sensors";
import { useMobile } from "@/lib/use-mobile";
import {
  MetricPolicyDialog,
  useMetricPolicyEditor,
} from "@/routes/_auth/estates/$estateId/sensors/-components/metric-policy-form";
import { metricLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

export function MetricPolicySettings({
  estateId,
  policies,
  canManage,
}: {
  estateId: string;
  policies: SensorPolicy[];
  canManage: boolean;
}) {
  const mobile = useMobile();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<SensorPolicy["metric"]>();
  const lastSelected = useRef<SensorPolicy["metric"] | undefined>(undefined);
  const policy = policies.find((item) => item.metric === selected);
  const close = useCallback(() => setSelected(undefined), []);
  const editor = useMetricPolicyEditor({
    estateId,
    policy,
    canManage,
    onClose: close,
  });
  const { isPending: saving, startEditing } = editor;
  const toggleExpanded = useCallback(() => {
    if (!saving) {
      setExpanded((current) => !current);
    }
  }, [saving]);
  const configured = policies.filter(
    (item) => item.durationMinutes !== null
  ).length;
  const open = useCallback(
    (metric: SensorPolicy["metric"]) => {
      if (saving) {
        return;
      }
      lastSelected.current = metric;
      const nextPolicy = policies.find((item) => item.metric === metric);
      if (nextPolicy) {
        startEditing(nextPolicy);
        setSelected(metric);
      }
    },
    [policies, saving, startEditing]
  );
  useEffect(() => {
    if (!(selected || saving) && lastSelected.current) {
      // biome-ignore lint/style/useDomQuerySelector: useId values are not valid CSS selectors
      document.getElementById(`${id}-${lastSelected.current}`)?.focus();
    }
  }, [id, saving, selected]);

  return (
    <Card className="min-w-0">
      <CardContent>
        <section aria-labelledby="policies-title">
          <h2 id="policies-title">
            <Button
              aria-controls={`${id}-content`}
              aria-describedby={`${id}-description ${id}-count`}
              aria-expanded={expanded}
              aria-label="Metric policies"
              className="grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 p-0 text-left whitespace-normal hover:bg-transparent sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center dark:hover:bg-transparent"
              disabled={saving}
              onClick={toggleExpanded}
              variant="ghost"
            >
              <SlidersHorizontal
                aria-hidden="true"
                className="text-muted-foreground mt-1 size-5 sm:mt-0"
              />
              <span className="min-w-0">
                <span className="block text-lg font-semibold">
                  Metric policies
                </span>
                <span
                  className="text-muted-foreground mt-1 block text-sm font-normal"
                  id={`${id}-description`}
                >
                  Estate-wide thresholds and tolerances
                </span>
              </span>
              <Badge
                className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1"
                id={`${id}-count`}
                variant="secondary"
              >
                {configured} of {policies.length} configured
              </Badge>
              <ChevronDown
                aria-hidden="true"
                className={`text-muted-foreground col-start-3 row-start-1 mt-1 size-5 transition-transform sm:col-start-4 sm:mt-0 ${expanded ? "rotate-180" : ""}`}
              />
            </Button>
          </h2>
          <div
            className="space-y-4 pt-5"
            hidden={!expanded}
            id={`${id}-content`}
          >
            {canManage ? null : (
              <p className="text-muted-foreground text-sm">
                Only estate owners and assigned managers can change metric
                policies.
              </p>
            )}
            {mobile ? (
              <ul aria-label="Metric policies" className="divide-y">
                {policies.map((item) => (
                  <li
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 first:pt-0"
                    key={item.metric}
                  >
                    <div className="min-w-0 space-y-2">
                      <PolicyName policy={item} />
                      <p className="text-muted-foreground text-sm">
                        <PolicySummary policy={item} />
                      </p>
                      <PolicyStatus policy={item} />
                    </div>
                    {canManage ? (
                      <PolicyAction
                        id={`${id}-${item.metric}`}
                        onOpen={open}
                        policy={item}
                        saving={saving}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Table aria-label="Metric policies">
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage ? (
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((item) => (
                    <TableRow key={item.metric}>
                      <TableCell className="py-4">
                        <PolicyName policy={item} />
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-normal">
                        <PolicySummary policy={item} />
                      </TableCell>
                      <TableCell>
                        <PolicyStatus policy={item} />
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <PolicyAction
                            id={`${id}-${item.metric}`}
                            onOpen={open}
                            policy={item}
                            saving={saving}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
        <MetricPolicyDialog
          canManage={canManage}
          editor={editor}
          onClose={close}
          policy={policy}
        />
      </CardContent>
    </Card>
  );
}

function PolicyName({ policy }: { policy: SensorPolicy }) {
  return (
    <>
      <p className="font-medium wrap-anywhere">{metricLabel(policy.metric)}</p>
      <p className="text-muted-foreground text-sm">{policy.unit}</p>
    </>
  );
}

function PolicySummary({ policy }: { policy: SensorPolicy }) {
  if (policy.durationMinutes === null) {
    return "No policy";
  }
  return `${policy.durationMinutes} ${policy.durationMinutes === 1 ? "minute" : "minutes"} · tolerance ${policy.tolerance} ${policy.unit}`;
}

function PolicyStatus({ policy }: { policy: SensorPolicy }) {
  const configured = policy.durationMinutes !== null;
  return (
    <Badge variant={configured ? "default" : "secondary"}>
      {configured ? "Configured" : "Not set"}
    </Badge>
  );
}

function PolicyAction({
  policy,
  saving,
  id,
  onOpen,
}: {
  policy: SensorPolicy;
  saving: boolean;
  id: string;
  onOpen: (metric: SensorPolicy["metric"]) => void;
}) {
  const open = useCallback(
    () => onOpen(policy.metric),
    [onOpen, policy.metric]
  );
  const label = policy.durationMinutes === null ? "Set up" : "Edit";
  return (
    <Button
      aria-haspopup="dialog"
      aria-label={`${label} ${metricLabel(policy.metric).toLowerCase()} policy`}
      disabled={saving}
      id={id}
      onClick={open}
      variant="ghost"
    >
      {label}
    </Button>
  );
}
