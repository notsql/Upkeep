import { ReportImage } from "@/components/reports/report-image";
import { useReportImage } from "@/lib/reports";

export function PrivateReportImage({
  reportId,
  imageId,
}: {
  reportId: string;
  imageId: string;
}) {
  const image = useReportImage(reportId, imageId);
  return <ReportImage isError={image.isError} url={image.data?.url} />;
}
