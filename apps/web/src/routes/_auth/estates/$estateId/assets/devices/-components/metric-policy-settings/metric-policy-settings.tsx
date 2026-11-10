import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@proj/ui/components/item";
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
import { metricLabel } from "@/components/sensors/sensor-format";
import type { SensorPolicy } from "@/lib/flatlined-sensors";
import { useMobile } from "@/lib/use-mobile";
import { MetricPolicyDialog } from "@/routes/_auth/estates/$estateId/assets/devices/-components/metric-policy-settings/metric-policy-form";
import { PolicyAction } from "@/routes/_auth/estates/$estateId/assets/devices/-components/metric-policy-settings/policy-action";
import { PolicyName } from "@/routes/_auth/estates/$estateId/assets/devices/-components/metric-policy-settings/policy-name";
import { PolicyStatus } from "@/routes/_auth/estates/$estateId/assets/devices/-components/metric-policy-settings/policy-status";
import { PolicySummary } from "@/routes/_auth/estates/$estateId/assets/devices/-components/metric-policy-settings/policy-summary";
import { useMetricPolicyEditor } from "@/routes/_auth/estates/$estateId/assets/devices/-components/metric-policy-settings/use-metric-policy-editor";

export function MetricPolicySettings({
  estateId,
  policies,
  canManage,
  defaultExpanded = false,
}: {
  estateId: string;
  policies: SensorPolicy[];
  canManage: boolean;
  /** Start open, as in the All devices dialog. */
  defaultExpanded?: boolean;
}) {
  const mobile = useMobile();
  const id = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
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
    <div className="min-w-0">
      <section aria-labelledby="policies-title">
        <h2 id="policies-title">
          <Button
            aria-controls={`${id}-content`}
            aria-describedby={`${id}-description ${id}-count`}
            aria-expanded={expanded}
            aria-label="When to warn"
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
              <span className="block text-lg font-semibold">When to warn</span>
              <span
                className="text-muted-foreground mt-1 block text-sm font-normal"
                id={`${id}-description`}
              >
                How long a sensor can send the same reading before we warn you
              </span>
            </span>
            <Badge
              className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1"
              id={`${id}-count`}
              variant="secondary"
            >
              {`${configured} of ${policies.length} set`}
            </Badge>
            <ChevronDown
              aria-hidden="true"
              className={`text-muted-foreground col-start-3 row-start-1 mt-1 size-5 transition-transform sm:col-start-4 sm:mt-0 ${expanded ? "rotate-180" : ""}`}
            />
          </Button>
        </h2>
        <div className="space-y-4 pt-5" hidden={!expanded} id={`${id}-content`}>
          {canManage ? null : (
            <p className="text-muted-foreground text-sm">
              You can view these settings but not change them.
            </p>
          )}
          {mobile ? (
            <ul aria-label="When to warn" className="flex flex-col">
              {policies.map((item, index) => (
                <li key={item.metric}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <Item size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="line-clamp-none [overflow-wrap:anywhere]">
                        {metricLabel(item.metric)}
                      </ItemTitle>
                      <ItemDescription className="text-xs">
                        <PolicySummary policy={item} />
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <PolicyStatus policy={item} />
                      {canManage ? (
                        <PolicyAction
                          id={`${id}-${item.metric}`}
                          onOpen={open}
                          policy={item}
                          saving={saving}
                        />
                      ) : null}
                    </ItemActions>
                  </Item>
                </li>
              ))}
            </ul>
          ) : (
            <Table aria-label="When to warn">
              <TableHeader>
                <TableRow>
                  <TableHead>Measurement</TableHead>
                  <TableHead>Warn after</TableHead>
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
    </div>
  );
}
