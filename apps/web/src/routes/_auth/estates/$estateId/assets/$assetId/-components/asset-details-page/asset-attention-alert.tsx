import { Alert } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  type AssetCondition,
  conditionLabel,
  conditionStyle,
  recorderName,
  useAssessments,
} from "@/lib/assessments";
import { formatAssessmentNotes, formatDate } from "@/lib/format";

/** Conditions that warrant an inspection, each with its banner tone. */
const BANNER_TONES: Partial<Record<AssetCondition, string>> = {
  NEEDS_ATTENTION: "warning",
  FAULTY: "destructive",
};

/**
 * A full-width banner under the asset header, on every tab, while the
 * current condition calls for an inspection. The button shows only to
 * viewers who can file one; the condition itself is shown to everyone.
 */
export function AssetAttentionAlert({
  assetId,
  canInspect,
  estateId,
}: {
  assetId: string;
  /** The asset and estate are active and the viewer can create inspections. */
  canInspect: boolean;
  estateId: string;
}) {
  // The API returns the current assessment first.
  const current = useAssessments(estateId, assetId).data?.[0];
  const tone = current ? BANNER_TONES[current.condition] : undefined;
  if (!(current && tone)) {
    return null;
  }
  const style = conditionStyle[current.condition];
  const Icon = style.icon;
  const notes = formatAssessmentNotes(current);
  return (
    <Alert
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5",
        style.surface
      )}
      data-tone={tone}
    >
      <Icon aria-hidden="true" className="shrink-0" />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-medium">{conditionLabel[current.condition]}</span>{" "}
        <span className="opacity-80">
          · flagged by {recorderName(current)} on{" "}
          {formatDate(current.assessedOn)}
        </span>
        {notes ? (
          <>
            <span aria-hidden="true" className="opacity-80">
              {" "}
              ·{" "}
            </span>
            <span className="opacity-80" title={notes}>
              {notes}
            </span>
          </>
        ) : null}
      </p>
      {canInspect ? (
        <Link
          className={buttonVariants({
            size: "sm",
            variant: current.condition === "FAULTY" ? "destructive" : "default",
          })}
          params={{ estateId, assetId }}
          to="/estates/$estateId/assets/$assetId/inspections/new"
        >
          File an inspection
        </Link>
      ) : null}
    </Alert>
  );
}
