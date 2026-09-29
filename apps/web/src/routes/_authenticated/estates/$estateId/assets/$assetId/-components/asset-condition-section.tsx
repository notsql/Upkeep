import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  type AssessmentInput,
  conditionLabel,
  useAssessments,
  useRecordAssessment,
} from "@/lib/assessments";
import { AssessmentForm } from "@/routes/_authenticated/estates/$estateId/assets/$assetId/-components/assessment-form";

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
  const openForm = useCallback(() => setRecording(true), []);
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
    <section aria-labelledby="condition-heading" className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-xl" id="condition-heading">
          Condition
        </h2>
        {canRecord && !recording ? (
          <Button onClick={openForm} variant="outline">
            Record assessment
          </Button>
        ) : null}
      </div>
      {assessments.isPending ? (
        <p aria-live="polite" className="mt-4">
          Loading condition…
        </p>
      ) : null}
      {assessments.error ? (
        <p className="mt-4 text-destructive" role="alert">
          {assessments.error.message}
        </p>
      ) : null}
      {assessments.data ? (
        <p
          aria-label="Current condition"
          className="mt-4 border p-4"
          role="status"
        >
          {current ? (
            <>
              <span className="font-medium">
                {conditionLabel[current.condition]}
              </span>{" "}
              <span className="text-muted-foreground text-sm">
                assessed {current.assessedOn}
              </span>
            </>
          ) : (
            "Not assessed yet"
          )}
        </p>
      ) : null}
      {recording ? <AssessmentForm onSave={save} /> : null}
      {assessments.data?.length ? (
        <>
          <h3 className="mt-6 font-medium">History</h3>
          <ul className="mt-2 grid gap-3">
            {assessments.data.map((assessment) => (
              <li className="border p-4 text-sm" key={assessment.id}>
                <p>
                  <span className="font-medium">
                    {conditionLabel[assessment.condition]}
                  </span>{" "}
                  · assessed {assessment.assessedOn}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{assessment.notes}</p>
                <p className="mt-2 text-muted-foreground">
                  Recorded by {assessment.recordedByName ?? "Unknown user"} on{" "}
                  {new Date(assessment.recordedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
