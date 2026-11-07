import { buttonVariants } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import type { WorkOrder } from "@/lib/work-orders";

export function WorkOrderDetailSummary({
  canReadReports,
  canRecordReadings,
  canViewAssets,
  canViewReadings,
  data,
  estateId,
}: {
  canReadReports: boolean;
  canRecordReadings: boolean;
  canViewAssets: boolean;
  canViewReadings: boolean;
  data: WorkOrder;
  estateId: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-6">
        <p className="whitespace-pre-wrap">{data.description}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt>Location</dt>
            <dd>{data.locationPath}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{data.category.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{data.priority}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{data.source.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Linked asset</dt>
            <dd>
              {data.assetId && canViewAssets ? (
                <Link
                  className="text-primary underline underline-offset-4 focus-visible:rounded-sm"
                  params={{ estateId, assetId: data.assetId }}
                  to="/estates/$estateId/assets/$assetId"
                >
                  {data.assetReference}
                </Link>
              ) : (
                (data.assetReference ?? "No linked asset")
              )}
            </dd>
          </div>
          {data.sourceReportId ? (
            <div>
              <dt>Resident report</dt>
              <dd>
                {canReadReports ? (
                  <Link
                    className="text-primary underline underline-offset-4 focus-visible:rounded-sm"
                    params={{ estateId, reportId: data.sourceReportId }}
                    to="/estates/$estateId/reports/$reportId"
                  >
                    View source report
                  </Link>
                ) : (
                  "Resident report linked"
                )}
              </dd>
            </div>
          ) : null}
          {data.sourceReference ? (
            <div>
              <dt>Source reference or explanation</dt>
              <dd className="whitespace-pre-wrap">{data.sourceReference}</dd>
            </div>
          ) : null}
        </dl>
        {data.assetId && (canViewReadings || canRecordReadings) ? (
          <div className="flex flex-wrap gap-2">
            {canViewReadings ? (
              <Link
                className={buttonVariants({ variant: "outline" })}
                params={{ estateId, assetId: data.assetId }}
                to="/estates/$estateId/readings/$assetId"
              >
                View readings
              </Link>
            ) : null}
            {canRecordReadings ? (
              <Link
                className={buttonVariants({ variant: "outline" })}
                params={{ estateId, assetId: data.assetId }}
                to="/estates/$estateId/readings/$assetId/new"
              >
                Record reading
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
          <p>
            Created by{" "}
            <span className="text-foreground font-medium">
              {data.createdByName?.trim() || "Name unavailable"}
            </span>
          </p>
          <time dateTime={data.createdAt}>
            {new Date(data.createdAt).toLocaleString()}
          </time>
        </div>
      </CardContent>
    </Card>
  );
}
