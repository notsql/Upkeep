import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Textarea } from "@proj/ui/components/textarea";
import { useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FormActions } from "@/components/form-actions";
import { PageHeader } from "@/components/page-header";
import { useEstateReport } from "@/lib/estate-reports";
import { flattenLocations, useLocations } from "@/lib/locations";
import {
  isSourcePlacementConflict,
  useCreateWorkOrder,
  useWorkOrderAccess,
  type WorkOrderAssetOption,
  type WorkOrderInput,
} from "@/lib/work-orders";
import { ReportSourcePicker } from "./report-source-picker";
import { WorkOrderAssetPicker } from "./work-order-asset-picker";
import { WorkOrderLocationFeedback } from "./work-order-location-feedback";
import { WorkOrderSaveError } from "./work-order-save-error";
import { WorkOrderSelect } from "./work-order-select";
import { WorkOrderSourceLocationChoice } from "./work-order-source-location-choice";

const categories: { value: WorkOrderInput["category"]; label: string }[] = [
  { value: "EQUIPMENT_FAULT", label: "Equipment fault" },
  { value: "CLEANLINESS", label: "Cleanliness" },
  { value: "SAFETY", label: "Safety" },
];
const priorities: { value: WorkOrderInput["priority"]; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];
const sources: { value: WorkOrderInput["source"]; label: string }[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "RESIDENT_REPORT", label: "Resident report" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "MAINTENANCE_RECOMMENDATION", label: "Maintenance recommendation" },
];
export function WorkOrderForm({
  estateId,
  sourceReportId,
}: {
  estateId: string;
  sourceReportId?: string;
}) {
  const access = useWorkOrderAccess(estateId);
  const save = useCreateWorkOrder(estateId);
  const navigate = useNavigate();
  const locations = useLocations(estateId);
  const [description, setDescription] = useState("");
  const [locationId, setLocation] = useState("");
  const [category, setCategory] =
    useState<WorkOrderInput["category"]>("EQUIPMENT_FAULT");
  const [priority, setPriority] =
    useState<WorkOrderInput["priority"]>("MEDIUM");
  const [source, setSource] = useState<WorkOrderInput["source"]>(
    sourceReportId ? "RESIDENT_REPORT" : "MANUAL"
  );
  const [reportId, setReportId] = useState(sourceReportId ?? "");
  const [sourceReference, setReference] = useState("");
  const [expectedLocation, setExpectedLocation] = useState<string>();
  const report = useEstateReport(
    estateId,
    source === "RESIDENT_REPORT" ? reportId : ""
  );
  const initialized = useRef<string | undefined>(undefined);
  const [asset, setAsset] = useState<WorkOrderAssetOption | undefined>(
    undefined
  );
  const [sourceChoice, setSourceChoice] = useState<
    | {
        id: string;
        label: string;
      }
    | undefined
  >(undefined);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<Error>();
  const saving = useRef<boolean>(false);
  useEffect(() => {
    if (
      report.data &&
      reportId &&
      initialized.current !== reportId &&
      !report.isError
    ) {
      initialized.current = reportId;
      setDescription(report.data.description);
      setLocation(asset?.locationId ?? report.data.location.id);
      setExpectedLocation(report.data.location.id);
    }
  }, [report.data, report.isError, reportId, asset]);
  const categoryChanged = useCallback((next: WorkOrderInput["category"]) => {
    setCategory(next);
    if (next === "SAFETY") {
      setPriority("URGENT");
    }
  }, []);
  const sourceChanged = useCallback((next: WorkOrderInput["source"]) => {
    setSource(next);
    setExpectedLocation(undefined);
    setError(undefined);
    setSourceChoice(undefined);
    if (next !== "RESIDENT_REPORT") {
      setReportId("");
      initialized.current = undefined;
    }
  }, []);
  const reloadSource = useCallback(async () => {
    setReloading(true);
    try {
      const result = await report.refetch();
      if (result.data && !result.isError) {
        if (isSourcePlacementConflict(error)) {
          setSourceChoice(result.data.location);
        } else {
          setExpectedLocation(result.data.location.id);
        }
        setError(undefined);
      }
    } finally {
      setReloading(false);
    }
  }, [report.refetch, error]);
  const changeAsset = useCallback((next: WorkOrderAssetOption | undefined) => {
    setAsset(next);
    if (next) {
      setLocation(next.locationId);
    }
  }, []);
  const canUseSource = !asset || asset.locationId === sourceChoice?.id;
  const useSourceLocation = useCallback(() => {
    if (!(sourceChoice && canUseSource)) {
      return;
    }
    setLocation(sourceChoice.id);
    setExpectedLocation(sourceChoice.id);
    setSourceChoice(undefined);
  }, [sourceChoice, canUseSource]);
  const keepWorkLocation = useCallback(() => {
    if (!sourceChoice) {
      return;
    }
    setExpectedLocation(sourceChoice.id);
    setSourceChoice(undefined);
  }, [sourceChoice]);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (saving.current || save.isPending || sourceChoice || reloading) {
        return;
      }
      saving.current = true;
      setError(undefined);
      try {
        const order = await save.mutateAsync(
          creationBody({
            description,
            locationId,
            category,
            priority,
            source,
            assetId: asset?.id,
            sourceReportId: reportId,
            expectedSourceLocationId: expectedLocation,
            sourceReference,
          })
        );
        await navigate({
          to: "/estates/$estateId/work-orders/$workOrderId",
          params: { estateId, workOrderId: order.id },
        });
      } catch (failure) {
        setError(workOrderFailure(failure));
      } finally {
        saving.current = false;
      }
    },
    [
      asset,
      sourceChoice,
      reloading,
      category,
      description,
      estateId,
      expectedLocation,
      locationId,
      navigate,
      priority,
      reportId,
      save.isPending,
      save.mutateAsync,
      source,
      sourceReference,
    ]
  );
  const changeDescription = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setDescription(event.target.value),
    []
  );
  const changeReference = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setReference(event.target.value),
    []
  );
  const retryLocations = useCallback(
    () => locations.refetch(),
    [locations.refetch]
  );
  if (access.pending) {
    return <p role="status">Loading access…</p>;
  }
  if (!access.canCreate) {
    return <p role="alert">Work-order creation is unavailable.</p>;
  }
  const options = locations.isError
    ? []
    : flattenLocations(locations.data ?? []);
  const reportSource = source === "RESIDENT_REPORT";
  const blocked =
    save.isPending ||
    reloading ||
    !!sourceChoice ||
    locations.isPending ||
    locations.isError ||
    !options.some((item) => item.id === locationId) ||
    sourceBlocked(
      source,
      access.canReadReports,
      expectedLocation,
      report.isPending,
      report.isError,
      error
    );
  return (
    <main className="page-layout space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: access.estateName ?? "Estate",
            to: access.canViewManagement ? "/estates/$estateId" : undefined,
            params: { estateId },
          },
          {
            label: "Work orders",
            to: "/estates/$estateId/work-orders",
            params: { estateId },
          },
          { label: "Create" },
        ]}
        description={access.estateName}
        title="Create work order"
      />
      <section aria-label="Work-order source" className="grid max-w-3xl gap-5">
        <WorkOrderSelect
          label="Source"
          onChange={sourceChanged}
          options={sources.filter(
            (item) => item.value !== "RESIDENT_REPORT" || access.canReadReports
          )}
          value={source}
        />
        {reportSource && access.canReadReports ? (
          <ReportSourcePicker
            estateId={estateId}
            onChange={setReportId}
            selectedTitle={report.data?.title}
            value={reportId}
          />
        ) : null}
      </section>
      <form className="form-layout grid max-w-3xl gap-5" onSubmit={submit}>
        {reportSource && report.isPending && reportId ? (
          <p role="status">Loading source report…</p>
        ) : null}
        {reportSource && report.isError ? (
          <p role="alert">
            Source report unavailable.{" "}
            <Button onClick={reloadSource} type="button">
              Retry source
            </Button>
          </p>
        ) : null}
        <SourceReferenceField
          onChange={changeReference}
          source={source}
          value={sourceReference}
        />
        <Field>
          <FieldLabel htmlFor="work-description">Description</FieldLabel>
          <Textarea
            id="work-description"
            maxLength={2500}
            onChange={changeDescription}
            required
            value={description}
          />
        </Field>
        <WorkOrderSelect
          disabled={!!asset}
          label="Location"
          onChange={setLocation}
          options={options.map((item) => ({
            value: item.id,
            label: item.path.join(" / "),
          }))}
          value={locationId}
        />
        <WorkOrderLocationFeedback
          estateId={estateId}
          expectedSourceLocationId={reportSource ? expectedLocation : undefined}
          failed={locations.isError}
          locations={options}
          onRetry={retryLocations}
          pending={locations.isPending}
        />
        <WorkOrderSelect
          label="Category"
          onChange={categoryChanged}
          options={categories}
          value={category}
        />
        <WorkOrderSelect
          disabled={category === "SAFETY"}
          label="Priority"
          onChange={setPriority}
          options={priorities}
          value={priority}
        />
        <WorkOrderAssetPicker
          estateId={estateId}
          locationId={locationId}
          onChange={changeAsset}
        />
        <WorkOrderSourceLocationChoice
          incompatibleAsset={!canUseSource}
          onKeepWork={keepWorkLocation}
          onUseSource={useSourceLocation}
          sourceLocation={sourceChoice?.label}
          workLocation={
            options.find((item) => item.id === locationId)?.path.join(" / ") ??
            locationId
          }
        />
        <WorkOrderSaveError
          error={error}
          estateId={estateId}
          reloadSource={reloadSource}
          reportSource={reportSource}
        />
        <FormActions label="Create work order" pending={blocked} />
      </form>
    </main>
  );
}

function workOrderFailure(failure: unknown): Error {
  return failure instanceof Error
    ? failure
    : new Error("Unable to save the work order.");
}

function creationBody(input: WorkOrderInput): WorkOrderInput {
  const {
    sourceReportId,
    expectedSourceLocationId,
    sourceReference,
    ...common
  } = input;
  const body = { ...common, description: common.description.trim() };
  if (input.source === "RESIDENT_REPORT") {
    return { ...body, sourceReportId, expectedSourceLocationId };
  }
  if (
    input.source === "INSPECTION" ||
    input.source === "MAINTENANCE_RECOMMENDATION"
  ) {
    return { ...body, sourceReference: sourceReference?.trim() };
  }
  return body;
}

function sourceBlocked(
  source: WorkOrderInput["source"],
  canReadReports: boolean,
  expectedLocation: string | undefined,
  pending: boolean,
  failed: boolean,
  error: Error | undefined
): boolean {
  if (source !== "RESIDENT_REPORT") {
    return false;
  }
  if (!(canReadReports && expectedLocation) || pending || failed) {
    return true;
  }
  return isSourcePlacementConflict(error);
}

function SourceReferenceField({
  source,
  value,
  onChange,
}: {
  source: WorkOrderInput["source"];
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  if (source !== "INSPECTION" && source !== "MAINTENANCE_RECOMMENDATION") {
    return null;
  }
  return (
    <Field>
      <FieldLabel htmlFor="work-source-reference">
        Source reference or explanation
      </FieldLabel>
      <Textarea
        id="work-source-reference"
        maxLength={500}
        onChange={onChange}
        required
        value={value}
      />
    </Field>
  );
}
