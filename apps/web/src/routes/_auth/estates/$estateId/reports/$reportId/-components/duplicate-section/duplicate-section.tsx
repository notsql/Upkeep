import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent, CardHeader } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { SectionHeading } from "@/components/page/section-heading";
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
        <DuplicateOfCard
          canReview={canReview}
          estateId={estateId}
          reload={reload}
          report={report}
        />
      ) : null}
      {report.duplicates.length > 0 ? (
        <LinkedDuplicatesCard estateId={estateId} report={report} />
      ) : null}
      {canReview && !report.duplicateOf && report.duplicates.length === 0 ? (
        <MarkDuplicateCard estateId={estateId} reportId={report.id} />
      ) : null}
    </>
  );
}

function DuplicateOfCard({
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
  const headingId = useId();
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
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <SectionHeading icon={Copy} id={headingId}>
            Duplicate
          </SectionHeading>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p>
            {suspected ? "Possible duplicate of" : "Duplicate of"}{" "}
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
              ? " If this is not a duplicate, reject the link to allow one."
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
                Not a duplicate
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function LinkedDuplicatesCard({
  estateId,
  report,
}: {
  estateId: string;
  report: EstateReport;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <SectionHeading icon={Copy} id={headingId}>
            Duplicates
          </SectionHeading>
          <div className="flex flex-wrap gap-1">
            <Badge variant={badgeVariantFor(duplicateReportTone.CONFIRMED)}>
              {report.confirmedDuplicateCount} confirmed
            </Badge>
            {report.suspectedDuplicateCount > 0 ? (
              <Badge variant={badgeVariantFor(duplicateReportTone.SUSPECTED)}>
                {report.suspectedDuplicateCount} to review
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </section>
  );
}

function MarkDuplicateCard({
  estateId,
  reportId,
}: {
  estateId: string;
  reportId: string;
}) {
  const headingId = useId();
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
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <SectionHeading icon={Copy} id={headingId}>
            Mark as duplicate
          </SectionHeading>
        </CardHeader>
        <CardContent className="grid gap-3">
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
            Link as duplicate
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
