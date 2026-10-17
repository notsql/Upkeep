import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { buttonVariants } from "@proj/ui/components/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { useReport, useReportImage } from "@/lib/reports";

export const Route = createFileRoute("/_auth/reports/$reportId/")({
  component: ReportDetailPage,
  head: () => ({ meta: [{ title: "Report details" }] }),
});

function PrivateImage({
  reportId,
  imageId,
}: {
  reportId: string;
  imageId: string;
}) {
  const image = useReportImage(reportId, imageId);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image.data) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(image.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image.data]);
  if (image.isError) {
    return <p role="alert">Unable to load an image.</p>;
  }
  if (!url) {
    return null;
  }
  return (
    <img
      alt="Submitted fault"
      className="h-auto w-full rounded-md object-contain"
      height={384}
      src={url}
      width={512}
    />
  );
}

function ReportDetailPage() {
  const id = useId();
  const { reportId } = useParams({ strict: false });
  const report = useReport(reportId ?? "");
  return (
    <main className="page-layout">
      <a className={buttonVariants({ size: "sm" })} href="/reports">
        Return to My Reports
      </a>
      <h1 className="my-4 font-semibold text-2xl">Report details</h1>
      {report.isPending ? <p role="status">Loading report…</p> : null}
      {report.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>Report not found or unavailable.</AlertDescription>
        </Alert>
      ) : null}
      {report.data ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="wrap-anywhere font-semibold">
                {report.data.title}
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <dl className="flex flex-wrap gap-x-1">
                <dt className="font-semibold">Estate name:</dt>
                <dd className="wrap-anywhere">{report.data.estateName}</dd>
              </dl>
              <dl className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-wrap gap-x-1">
                  <dt className="font-semibold">Location:</dt>
                  <dd className="wrap-anywhere italic">
                    {report.data.location?.label}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="font-semibold">Status:</dt>
                  <dd>
                    <Badge className="w-fit">{report.data.status}</Badge>
                  </dd>
                </div>
              </dl>
              <dl className="flex flex-wrap gap-x-1">
                <dt className="font-semibold">Submission time:</dt>
                <dd>
                  <time dateTime={report.data.createdAt}>
                    {report.data.createdAt
                      ? new Date(report.data.createdAt).toLocaleString()
                      : ""}
                  </time>
                </dd>
              </dl>
            </div>
            <section
              aria-labelledby={`${id}-description`}
              className="min-w-0 space-y-2"
            >
              <h3 className="font-semibold" id={`${id}-description`}>
                Description
              </h3>
              <p className="wrap-anywhere whitespace-pre-wrap">
                {report.data.description}
              </p>
            </section>
            <section
              aria-labelledby={`${id}-images`}
              className="min-w-0 space-y-2"
            >
              <h3 className="font-semibold" id={`${id}-images`}>
                Images
              </h3>
              {(report.data.images?.length ?? 0) === 0 ? (
                <p>No images submitted.</p>
              ) : (
                <div className="grid gap-3">
                  {report.data.images?.map((image) =>
                    image.id ? (
                      <PrivateImage
                        imageId={image.id}
                        key={image.id}
                        reportId={reportId ?? ""}
                      />
                    ) : null
                  )}
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
