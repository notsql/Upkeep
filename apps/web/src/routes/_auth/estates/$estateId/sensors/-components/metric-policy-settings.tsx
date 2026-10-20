import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { SensorPolicy } from "@/lib/flatlined-sensors";
import { useMobile } from "@/lib/use-mobile";
import {
  MetricPolicyForm,
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
  const toggle = useCallback(
    (metric: SensorPolicy["metric"]) => {
      if (saving) {
        return;
      }
      lastSelected.current = metric;
      if (selected === metric) {
        close();
        return;
      }
      const nextPolicy = policies.find((item) => item.metric === metric);
      if (nextPolicy) {
        startEditing(nextPolicy);
        setSelected(metric);
      }
    },
    [close, policies, saving, selected, startEditing]
  );
  useEffect(() => {
    if (!(selected || saving) && lastSelected.current) {
      document.getElementById(`${id}-${lastSelected.current}`)?.focus();
    }
  }, [id, saving, selected]);
  const form = policy ? (
    <MetricPolicyForm
      canManage={canManage}
      editor={editor}
      id={`${id}-editor`}
      key={policy.metric}
      onClose={close}
      policy={policy}
    />
  ) : null;

  return (
    <section
      aria-labelledby="policies-title"
      className="section-surface min-w-0"
    >
      <h2 id="policies-title">
        <Button
          aria-controls={`${id}-content`}
          aria-describedby={`${id}-description ${id}-count`}
          aria-expanded={expanded}
          aria-label="Metric policies"
          className="grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 whitespace-normal p-0 text-left hover:bg-transparent sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center dark:hover:bg-transparent"
          disabled={saving}
          onClick={toggleExpanded}
          variant="ghost"
        >
          <SlidersHorizontal
            aria-hidden="true"
            className="mt-1 size-5 text-muted-foreground sm:mt-0"
          />
          <span className="min-w-0">
            <span className="block font-semibold text-lg">Metric policies</span>
            <span
              className="mt-1 block font-normal text-muted-foreground text-sm"
              id={`${id}-description`}
            >
              Manage estate-wide metric thresholds and tolerances.
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
            className={`col-start-3 row-start-1 mt-1 size-5 text-muted-foreground transition-transform sm:col-start-4 sm:mt-0 ${expanded ? "rotate-180" : ""}`}
          />
        </Button>
      </h2>
      <div className="space-y-4 pt-5" hidden={!expanded} id={`${id}-content`}>
        {canManage ? null : (
          <p className="text-muted-foreground text-sm">
            Only estate owners and assigned managers can change metric policies.
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
                    editorId={`${id}-editor`}
                    id={`${id}-${item.metric}`}
                    onToggle={toggle}
                    policy={item}
                    saving={saving}
                    selected={selected === item.metric}
                  />
                ) : null}
                {selected === item.metric ? (
                  <div className="col-span-2 min-w-0">{form}</div>
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
                <Fragment key={item.metric}>
                  <TableRow>
                    <TableCell className="py-4">
                      <PolicyName policy={item} />
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      <PolicySummary policy={item} />
                    </TableCell>
                    <TableCell>
                      <PolicyStatus policy={item} />
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <PolicyAction
                          editorId={`${id}-editor`}
                          id={`${id}-${item.metric}`}
                          onToggle={toggle}
                          policy={item}
                          saving={saving}
                          selected={selected === item.metric}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                  {selected === item.metric ? (
                    <TableRow>
                      <TableCell
                        className="whitespace-normal p-0 pb-4"
                        colSpan={canManage ? 4 : 3}
                      >
                        {form}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}

function PolicyName({ policy }: { policy: SensorPolicy }) {
  return (
    <>
      <p className="wrap-anywhere font-medium">{metricLabel(policy.metric)}</p>
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
    <Badge
      className={
        configured
          ? "border-status-active-foreground/20 bg-status-active text-status-active-foreground"
          : undefined
      }
      variant="secondary"
    >
      {configured ? "Configured" : "Not set"}
    </Badge>
  );
}

function PolicyAction({
  policy,
  selected,
  saving,
  id,
  editorId,
  onToggle,
}: {
  policy: SensorPolicy;
  selected: boolean;
  saving: boolean;
  id: string;
  editorId: string;
  onToggle: (metric: SensorPolicy["metric"]) => void;
}) {
  const toggle = useCallback(
    () => onToggle(policy.metric),
    [onToggle, policy.metric]
  );
  const editLabel = policy.durationMinutes === null ? "Set up" : "Edit";
  const label = selected ? "Close" : editLabel;
  return (
    <Button
      aria-controls={selected ? editorId : undefined}
      aria-expanded={selected}
      aria-label={`${label} ${metricLabel(policy.metric).toLowerCase()} policy`}
      disabled={saving}
      id={id}
      onClick={toggle}
      variant={selected ? "secondary" : "outline"}
    >
      {label}
    </Button>
  );
}
