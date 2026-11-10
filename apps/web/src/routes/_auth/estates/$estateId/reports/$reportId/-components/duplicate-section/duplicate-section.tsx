import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { PageSection } from "@/components/page/section-card";
import { DuplicateStateBadge } from "@/components/reports/duplicate-badges";
import { ReportSourcePicker } from "@/components/reports/report-source-picker";
import {
  type EstateReport,
  ReportRequestError,
  useLinkEstateReportDuplicate,
  useReviewEstateReportDuplicate,
} from "@/lib/estate-reports";
import { badgeVariantFor, duplicateReportTone } from "@/lib/status-tone";

type ReviewState = components["schemas"]["ReviewDuplicateRequest"]["state"];

/**
 * Duplicate information on a report's detail (ID-74): the original it repeats, the
 * reports that repeat it, and, for managers, review and manual linking.
 */
export function DuplicateSection({
  estateId,
  report,
  canReview,
  reload,
}: {
  estateId: string;
  report: EstateReport;
  canReview: boolean;
  reload: () => Promise<unknown>;
}) {
  return (
    <>
      {report.duplicateOf ? (
        <DuplicateOfSection
          canReview={canReview}
          estateId={estateId}
          reload={reload}
          report={report}
        />
      ) : null}
      {report.duplicates.length > 0 ? (
        <LinkedDuplicatesSection estateId={estateId} report={report} />
      ) : null}
      {canReview && !report.duplicateOf && report.duplicates.length === 0 ? (
        <MarkDuplicateSection estateId={estateId} reportId={report.id} />
      ) : null}
    </>
  );
}

function DuplicateOfSection({
  estateId,
  report,
  canReview,
  reload,
}: {
  estateId: string;
  report: EstateReport;
  canReview: boolean;
  reload: () => Promise<unknown>;
}) {
  const review = useReviewEstateReportDuplicate(estateId, report.id);
  const original = report.duplicateOf;
  const decide = useCallback(
    (state: ReviewState) => {
      // duplicateOf only ever carries an active link.
      if (!original || original.state === "REJECTED") {
        return;
      }
      review.mutate({ state, expectedState: original.state });
    },
    [original, review.mutate]
  );
  const confirm = useCallback(() => decide("CONFIRMED"), [decide]);
  const reject = useCallback(() => decide("REJECTED"), [decide]);
  const reloadAfterConflict = useCallback(async () => {
    review.reset();
    await reload();
  }, [reload, review.reset]);
  if (!original) {
    return null;
  }
  const suspected = original.state === "SUSPECTED";
  const conflict =
    review.error instanceof ReportRequestError && review.error.status === 409;
  return (
    <PageSection icon={Copy} title="Already reported">
      <div className="grid gap-3">
        <p>
          {suspected ? "May be the same problem as" : "Same problem as"}{" "}
          <Link
            params={{ estateId, reportId: original.reportId }}
            to="/estates/$estateId/reports/$reportId"
          >
            {original.title}
          </Link>
        </p>
        <p className="text-muted-foreground">
          This report cannot get its own work order. Use the original and its
          work orders.
          {suspected
            ? " If it's a different problem, choose Not the same problem first."
            : null}
        </p>
        {review.error ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>
              {review.error.message}{" "}
              {conflict ? (
                <Button onClick={reloadAfterConflict} variant="outline">
                  Reload
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {canReview ? (
          <div className="flex flex-wrap gap-2">
            {suspected ? (
              <Button disabled={review.isPending} onClick={confirm}>
                Confirm
              </Button>
            ) : null}
            <Button
              disabled={review.isPending}
              onClick={reject}
              variant="outline"
            >
              Not the same problem
            </Button>
          </div>
        ) : null}
      </div>
    </PageSection>
  );
}

function LinkedDuplicatesSection({
  estateId,
  report,
}: {
  estateId: string;
  report: EstateReport;
}) {
  return (
    <PageSection
      actions={
        <>
          <Badge variant={badgeVariantFor(duplicateReportTone.CONFIRMED)}>
            {report.confirmedDuplicateCount} confirmed
          </Badge>
          {report.suspectedDuplicateCount > 0 ? (
            <Badge variant={badgeVariantFor(duplicateReportTone.SUSPECTED)}>
              {report.suspectedDuplicateCount} to review
            </Badge>
          ) : null}
        </>
      }
      icon={Copy}
      title="Repeat reports"
    >
      <ul className="grid gap-2">
        {report.duplicates.map((duplicate) => (
          <li
            className="flex flex-wrap items-center gap-x-2 gap-y-1"
            key={duplicate.reportId}
          >
            <Link
              params={{ estateId, reportId: duplicate.reportId }}
              to="/estates/$estateId/reports/$reportId"
            >
              {duplicate.title}
            </Link>
            <DuplicateStateBadge state={duplicate.state} />
            <span className="text-muted-foreground italic">
              {duplicate.location.label}
            </span>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

function MarkDuplicateSection({
  estateId,
  reportId,
}: {
  estateId: string;
  reportId: string;
}) {
  const [originalId, setOriginalId] = useState("");
  const link = useLinkEstateReportDuplicate(estateId, reportId);
  const choose = useCallback(
    (id: string) => {
      setOriginalId(id);
      link.reset();
    },
    [link.reset]
  );
  const save = useCallback(
    () => link.mutate({ originalReportId: originalId }),
    [link.mutate, originalId]
  );
  return (
    <PageSection icon={Copy} title="Mark as duplicate">
      <div className="grid gap-3">
        <ReportSourcePicker
          chooseLabel="Choose original report"
          emptyText="No other reports match these filters."
          estateId={estateId}
          excludeId={reportId}
          label="Original report"
          onChange={choose}
          value={originalId}
        />
        {link.error ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{link.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          className="w-fit"
          disabled={!originalId || link.isPending}
          onClick={save}
        >
          Mark as same problem
        </Button>
      </div>
    </PageSection>
  );
}
