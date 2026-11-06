import { FormDialog } from "@/components/dialogs/form-dialog";
import type { SensorPolicy } from "@/lib/flatlined-sensors";
import { MetricPolicyFields } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/metric-policy-settings/metric-policy-fields";
import type { useMetricPolicyEditor } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/metric-policy-settings/use-metric-policy-editor";
import { metricLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-format";

/** The metric policy editor, opened in a FormDialog from its row's Edit / Set up button. */
export function MetricPolicyDialog({
  policy,
  onClose,
  canManage,
  editor,
}: {
  policy: SensorPolicy | undefined;
  onClose: () => void;
  canManage: boolean;
  editor: ReturnType<typeof useMetricPolicyEditor>;
}) {
  const label = policy ? metricLabel(policy.metric) : "";
  let description: string | undefined;
  if (policy) {
    description =
      policy.durationMinutes === null
        ? "Not configured"
        : `Current: ${policy.durationMinutes} minutes · tolerance ${policy.tolerance} ${policy.unit}`;
  }
  return (
    <FormDialog
      description={description}
      error={editor.errorMessage}
      onClose={onClose}
      onSubmit={editor.handleSubmit}
      open={Boolean(policy)}
      pending={editor.isPending}
      submitDisabled={!canManage}
      submitLabel="Save policy"
      title={`${label} policy`}
    >
      {policy ? (
        <MetricPolicyFields
          canManage={canManage}
          editor={editor}
          key={policy.metric}
          policy={policy}
        />
      ) : null}
    </FormDialog>
  );
}
