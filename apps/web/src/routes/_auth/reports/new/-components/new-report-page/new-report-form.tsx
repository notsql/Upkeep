import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { LoadingState } from "@/components/states/loading-state";
import { ReportDetailsFields } from "@/routes/_auth/reports/new/-components/new-report-page/report-details-fields";
import { ReportImagesField } from "@/routes/_auth/reports/new/-components/new-report-page/report-images-field";
import { ReportLocationFields } from "@/routes/_auth/reports/new/-components/new-report-page/report-location-fields";
import { ResidentEstateSelector } from "@/routes/_auth/reports/new/-components/new-report-page/resident-estate-selector";
import { useNewReportForm } from "@/routes/_auth/reports/new/-components/new-report-page/use-new-report-form";

export function NewReportForm({
  estates,
  initialEstateId,
}: {
  estates: components["schemas"]["ResidentContextResponse"]["estates"];
  initialEstateId?: string;
}) {
  const form = useNewReportForm(estates, initialEstateId);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{form.estateName}</CardTitle>
      </CardHeader>
      <CardContent>
        {form.locations.isLoading ? (
          <LoadingState label="Loading locations…" rows={1} />
        ) : null}
        {form.locations.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>
              Unable to load locations. Please try again.
            </AlertDescription>
          </Alert>
        ) : null}
        <form className="grid gap-4" onSubmit={form.submit}>
          <ResidentEstateSelector
            estateId={form.estateId}
            estates={estates}
            id={form.id}
            onChange={form.changeEstate}
          />
          <ReportLocationFields
            blockId={form.blockId}
            commonId={form.commonId}
            id={form.id}
            levelId={form.levelId}
            locations={form.locations.data ?? []}
            onBlockChange={form.changeBlock}
            onCommonChange={form.setCommonId}
            onLevelChange={form.changeLevel}
          />
          <ReportDetailsFields
            description={form.description}
            id={form.id}
            onDescriptionChange={form.changeDescription}
            onTitleChange={form.changeTitle}
            title={form.title}
          />
          <ReportImagesField
            id={form.id}
            images={form.images}
            onChange={form.changeImages}
            onRemove={form.removeImage}
          />
          {form.error ? (
            <Alert role="alert" variant="destructive">
              <AlertDescription>{form.error}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-muted-foreground text-sm">
            To get your report to the right people quickly, its text and photos
            are analysed by an AI service (Anthropic) and may be emailed to the
            estate's contractor. Please don't include personal details you don't
            want shared.
          </p>
          <Button
            disabled={
              form.create.isPending ||
              !form.estateId ||
              form.locations.isPending ||
              form.locations.isError
            }
            type="submit"
          >
            {form.create.isPending ? "Submitting…" : "Submit report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
