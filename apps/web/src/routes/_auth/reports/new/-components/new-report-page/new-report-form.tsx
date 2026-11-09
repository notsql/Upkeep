import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import {
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@proj/ui/components/field";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { FormActions } from "@/components/forms/form-actions";
import { FormCard } from "@/components/page/form-page";
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
  const navigate = useNavigate();
  const cancel = useCallback(() => {
    navigate({
      to: "/reports",
      search: { estateId: form.estateId ?? undefined },
    });
  }, [navigate, form.estateId]);

  return (
    <FormCard title={form.estateName}>
      <form className="grid gap-5" onSubmit={form.submit}>
        {form.locations.isLoading ? (
          <LoadingState label="Loading locations…" rows={1} />
        ) : null}
        {form.locations.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Couldn't load locations. Try again.
            </AlertDescription>
          </Alert>
        ) : null}
        <FieldSet>
          <FieldLegend>Where is the fault?</FieldLegend>
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
        </FieldSet>
        <FieldSeparator />
        <FieldSet>
          <FieldLegend>What is wrong?</FieldLegend>
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
        </FieldSet>
        {form.error ? (
          <Alert variant="destructive">
            <AlertDescription>{form.error}</AlertDescription>
          </Alert>
        ) : null}
        <FormActions
          disabled={
            !form.estateId || form.locations.isPending || form.locations.isError
          }
          label={form.create.isPending ? "Submitting…" : "Submit report"}
          onCancel={cancel}
          pending={form.create.isPending}
        />
      </form>
    </FormCard>
  );
}
