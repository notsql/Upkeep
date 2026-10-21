import { ReportImage } from "@/components/reports/report-image";
import { useEstateReportImage } from "@/lib/estate-reports";

export function PrivateReportImage({
  estateId,
  reportId,
  imageId,
}: {
  estateId: string;
  reportId: string;
  imageId: string;
}) {
  const image = useEstateReportImage(estateId, reportId, imageId);
  return (
    <ReportImage
      data={image.data}
      isError={image.isError}
      loading={<p role="status">Loading image…</p>}
    />
  );
}
