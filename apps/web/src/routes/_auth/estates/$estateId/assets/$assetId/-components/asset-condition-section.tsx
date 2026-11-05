import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { HeartPulse } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ConditionBadge } from "@/components/condition-badge";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { SectionCard } from "@/components/section-card";
import {
  type AssessmentInput,
  useAssessments,
  useRecordAssessment,
} from "@/lib/assessments";
import { AssessmentForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/assessment-form";

/** The identity the server records anomaly-detection assessments under. */
const ANOMALY_MODEL_USER_ID = "system:anomaly-model";

export function AssetConditionSection({
  assetId,
  canRecord,
  estateId,
}: {
  assetId: string;
  canRecord: boolean;
  estateId: string;
}) {
  const assessments = useAssessments(estateId, assetId);
  const recordAssessment = useRecordAssessment(estateId, assetId);
  const [recording, setRecording] = useState(false);
  const changeOpen = useCallback(
    (open: boolean) => {
      if (!recordAssessment.isPending) {
        setRecording(open);
      }
    },
    [recordAssessment.isPending]
  );
  const cancel = useCallback(() => setRecording(false), []);
  const retry = useCallback(() => assessments.refetch(), [assessments.refetch]);
  const save = useCallback(
    async (values: AssessmentInput) => {
      await recordAssessment.mutateAsync(values);
      setRecording(false);
      toast.success("Assessment recorded.");
    },
    [recordAssessment.mutateAsync]
  );
  // The API returns the current condition first.
  const current = assessments.data?.[0];

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
            <>
              <h3 className="mt-6 font-medium">History</h3>
              <ul className="mt-2 grid gap-3">
                {assessments.data.map((assessment) => (
                  <li key={assessment.id}>
                    <Card size="sm">
                      <CardContent>
                        <p>
                          <ConditionBadge condition={assessment.condition} /> ·
                          assessed {assessment.assessedOn}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap">
                          {assessment.notes}
                        </p>
                        <p className="text-muted-foreground mt-2">
                          Recorded by{" "}
                          {assessment.recordedByUserId === ANOMALY_MODEL_USER_ID
                            ? "Anomaly detection"
                            : (assessment.recordedByName ??
                              "Unknown user")}{" "}
                          on {new Date(assessment.recordedAt).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </SectionCard>
    </Dialog>
  );
}
