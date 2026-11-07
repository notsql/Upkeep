import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { HeartPulse } from "lucide-react";
import { SectionCard } from "@/components/page/section-card";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { ConditionBadge } from "@/routes/_auth/estates/$estateId/assets/-components/condition-badge";
import { AssessmentForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/assessment-form";
import { AssetConditionHistory } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-history";
import { useAssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/use-asset-condition-section";

export function AssetConditionSection({
  assetId,
  canRecord,
  estateId,
}: {
  assetId: string;
  canRecord: boolean;
  estateId: string;
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
            <DialogTrigger render={<Button variant="outline" />}>
              Record assessment
            </DialogTrigger>
          ) : undefined
        }
        icon={HeartPulse}
        title="Condition"
      >
        <div>
          {assessments.isPending ? (
            <LoadingState label="Loading condition…" rows={2} />
          ) : null}
          {assessments.error ? (
            <ErrorState message={assessments.error.message} onRetry={retry} />
          ) : null}
          {assessments.data ? (
            <p
              aria-label="Current condition"
              className="flex flex-wrap items-center gap-2 text-sm"
              role="status"
            >
              {current ? (
                <>
                  <ConditionBadge condition={current.condition} />{" "}
                  <span className="text-muted-foreground text-sm">
                    assessed {current.assessedOn}
                  </span>
                </>
              ) : (
                "Not assessed yet"
              )}
            </p>
          ) : null}
          {recording && canRecord ? (
            <DialogContent
              className="sm:max-w-lg"
              showCloseButton={!recordAssessment.isPending}
            >
              <DialogHeader>
                <DialogTitle>Record assessment</DialogTitle>
                <DialogDescription>
                  Record the condition, assessment date and notes.
                </DialogDescription>
              </DialogHeader>
              <AssessmentForm onCancel={cancel} onSave={save} />
            </DialogContent>
          ) : null}
          {assessments.data?.length ? (
            <AssetConditionHistory assessments={assessments.data} />
          ) : null}
        </div>
      </SectionCard>
    </Dialog>
  );
}
