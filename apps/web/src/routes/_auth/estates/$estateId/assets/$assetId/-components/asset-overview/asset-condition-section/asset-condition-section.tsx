import { Button, buttonVariants } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { Separator } from "@proj/ui/components/separator";
import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardCheck, HeartPulse } from "lucide-react";
import type { ReactNode } from "react";
import { SECTION_ACTION, SectionCard } from "@/components/page/section-card";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type Assessment,
  conditionLabel,
  conditionStyle,
  recorderName,
} from "@/lib/assessments";
import { formatAssessmentNotes, formatDate } from "@/lib/format";
import { AssessmentForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/assessment-form";
import { useAssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/use-asset-condition-section";

/** Headline (icon + label in the condition's tone), one meta line, the note. */
function CurrentCondition({ current }: { current: Assessment | undefined }) {
  if (!current) {
    return (
      <div
        aria-label="Current condition"
        className="text-muted-foreground text-sm"
        role="status"
      >
        Not checked yet
      </div>
    );
  }
  const style = conditionStyle[current.condition];
  const Icon = style.icon;
  const notes = formatAssessmentNotes(current);
  return (
    <div aria-label="Current condition" className="grid gap-2" role="status">
      <p
        className={cn(
          "flex items-center gap-2 text-2xl font-semibold",
          style.text
        )}
        data-tone={style.tone}
      >
        <Icon aria-hidden="true" className="size-6 shrink-0" />
        <span>{conditionLabel[current.condition]}</span>
      </p>
      <p className="text-muted-foreground text-xs">
        {`Assessed ${formatDate(current.assessedOn)} · ${recorderName(current)}`}
      </p>
      {notes ? (
        <p className="line-clamp-3 text-sm whitespace-pre-wrap" title={notes}>
          {notes}
        </p>
      ) : null}
    </div>
  );
}

export function AssetConditionSection({
  assetId,
  canRecord,
  estateId,
  upcoming,
}: {
  assetId: string;
  canRecord: boolean;
  estateId: string;
  /** Work coming up, shown under the condition as a sub-section. */
  upcoming?: ReactNode;
}) {
  const {
    assessments,
    cancel,
    changeOpen,
    current,
    recordAssessment,
    recording,
    retry,
    save,
  } = useAssetConditionSection(estateId, assetId);

  return (
    <Dialog onOpenChange={changeOpen} open={recording && canRecord}>
      <SectionCard
        actions={
          canRecord && !recording ? (
            <DialogTrigger render={<Button {...SECTION_ACTION} />}>
              <ClipboardCheck aria-hidden="true" />
              Record condition check
            </DialogTrigger>
          ) : undefined
        }
        className="h-full"
        contentClassName="flex flex-1 flex-col gap-4"
        icon={HeartPulse}
        title="Condition"
      >
        {assessments.isPending ? (
          <LoadingState label="Loading condition…" rows={2} />
        ) : null}
        {assessments.error ? (
          <ErrorState message={assessments.error.message} onRetry={retry} />
        ) : null}
        {assessments.data ? <CurrentCondition current={current} /> : null}
        {recording && canRecord ? (
          <DialogContent
            className="sm:max-w-lg"
            showCloseButton={!recordAssessment.isPending}
          >
            <DialogHeader>
              <DialogTitle>Record condition check</DialogTitle>
              <DialogDescription>
                Record the condition, assessment date and notes.
              </DialogDescription>
            </DialogHeader>
            <AssessmentForm onCancel={cancel} onSave={save} />
          </DialogContent>
        ) : null}
        {assessments.data && assessments.data.length > 1 ? (
          <Link
            className={buttonVariants({
              className: "mt-auto -ml-2.5 self-start",
              size: "sm",
              variant: "link",
            })}
            params={{ estateId, assetId }}
            to="/estates/$estateId/assets/$assetId/condition"
          >
            View history ({assessments.data.length})
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
        {upcoming ? (
          <>
            <Separator />
            {upcoming}
          </>
        ) : null}
      </SectionCard>
    </Dialog>
  );
}
