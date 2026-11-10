import { Badge } from "@proj/ui/components/badge";
import { cn } from "@proj/ui/lib/utils";
import { Cpu, HeartPulse, User } from "lucide-react";
import { useCallback } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type Assessment,
  conditionLabel,
  conditionStyle,
  recordedByModel,
  recorderName,
  useAssessments,
} from "@/lib/assessments";
import { formatAssessmentNotes, formatDate } from "@/lib/format";

/** "September 2026" for a YYYY-MM-DD date, read as a calendar date. */
function monthLabel(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  );
}

function TimelineEntry({
  assessment,
  current,
  month,
}: {
  assessment: Assessment;
  current: boolean;
  /** Set on the first entry of each month, to head it. */
  month?: string;
}) {
  const style = conditionStyle[assessment.condition];
  const Icon = style.icon;
  const Source = recordedByModel(assessment) ? Cpu : User;
  const notes = formatAssessmentNotes(assessment);
  return (
    <li
      className="group/timeline relative pb-6 pl-12 last:pb-0"
      data-tone={style.tone}
    >
      {month ? (
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          {month}
        </h2>
      ) : null}
      <div className="relative">
        <span
          aria-hidden="true"
          className="bg-border absolute top-10 -bottom-5 -left-8 w-px group-last/timeline:hidden"
        />
        <span
          className={cn(
            "absolute top-0 -left-12 flex size-8 items-center justify-center rounded-full ring-1",
            style.node,
            style.text
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="grid gap-1 text-sm">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("font-semibold", style.text)}>
              {conditionLabel[assessment.condition]}
            </span>
            {current ? <Badge variant="info">Current</Badge> : null}
          </p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <span>{formatDate(assessment.assessedOn)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Source aria-hidden="true" className="size-3.5" />
              <span>{recorderName(assessment)}</span>
            </span>
          </p>
          {notes ? <p className="whitespace-pre-wrap">{notes}</p> : null}
        </div>
      </div>
    </li>
  );
}

/** The assessments endpoint returns the whole history, current first. */
export function ConditionHistoryList({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const assessments = useAssessments(estateId, assetId);
  const retry = useCallback(() => assessments.refetch(), [assessments.refetch]);
  if (assessments.isPending) {
    return <LoadingState label="Loading condition history…" rows={3} />;
  }
  if (assessments.error) {
    return <ErrorState message={assessments.error.message} onRetry={retry} />;
  }
  if (!assessments.data.length) {
    return (
      <EmptyState
        description="Condition checks you record appear here."
        icon={HeartPulse}
        title="Not checked yet"
      />
    );
  }
  return (
    <ol aria-label="Condition history">
      {assessments.data.map((assessment, index) => {
        const month = assessment.assessedOn.slice(0, 7);
        const previous = assessments.data[index - 1]?.assessedOn.slice(0, 7);
        return (
          <TimelineEntry
            assessment={assessment}
            current={index === 0}
            key={assessment.id}
            month={
              month === previous ? undefined : monthLabel(assessment.assessedOn)
            }
          />
        );
      })}
    </ol>
  );
}
