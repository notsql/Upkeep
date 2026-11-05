import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  type AssessmentInput,
  useAssessments,
  useRecordAssessment,
} from "@/lib/assessments";

export function useAssetConditionSection(estateId: string, assetId: string) {
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

  return {
    assessments,
    cancel,
    changeOpen,
    current,
    recordAssessment,
    recording,
    retry,
    save,
  };
}
