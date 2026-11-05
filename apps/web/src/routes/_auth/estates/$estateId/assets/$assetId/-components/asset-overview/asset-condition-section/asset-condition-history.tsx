import { Card, CardContent } from "@proj/ui/components/card";
import type { Assessment } from "@/lib/assessments";
import { ConditionBadge } from "@/routes/_auth/estates/$estateId/assets/-components/condition-badge";

/** The identity the server records anomaly-detection assessments under. */
const ANOMALY_MODEL_USER_ID = "system:anomaly-model";

export function AssetConditionHistory({
  assessments,
}: {
  assessments: Assessment[];
}) {
  return (
    <>
      <h3 className="mt-6 font-medium">History</h3>
      <ul className="mt-2 grid gap-3">
        {assessments.map((assessment) => (
          <li key={assessment.id}>
            <Card size="sm">
              <CardContent>
                <p>
                  <ConditionBadge condition={assessment.condition} /> · assessed{" "}
                  {assessment.assessedOn}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{assessment.notes}</p>
                <p className="text-muted-foreground mt-2">
                  Recorded by{" "}
                  {assessment.recordedByUserId === ANOMALY_MODEL_USER_ID
                    ? "Anomaly detection"
                    : (assessment.recordedByName ?? "Unknown user")}{" "}
                  on {new Date(assessment.recordedAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
