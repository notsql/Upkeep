import { ReportImage } from "@/components/reports/report-image";
import { LoadingState } from "@/components/states/loading-state";
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
      isError={image.isError}
      loading={<LoadingState label="Loading image…" rows={1} />}
      url={image.data?.url}
    />
  );
}
