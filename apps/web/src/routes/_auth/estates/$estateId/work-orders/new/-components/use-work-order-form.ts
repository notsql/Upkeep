import { useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useEstateReport } from "@/lib/estate-reports";
import { flattenLocations, useLocations } from "@/lib/locations";
import {
  isSourcePlacementConflict,
  useCreateWorkOrder,
  useWorkOrderAccess,
  type WorkOrderAssetOption,
  type WorkOrderInput,
  WorkOrderRequestError,
} from "@/lib/work-orders";
import { useWorkOrderInspection } from "./use-work-order-inspection";

export function useWorkOrderForm(
  estateId: string,
  sourceReportId?: string,
  sourceInspectionId?: string
) {
  const access = useWorkOrderAccess(estateId);
  const save = useCreateWorkOrder(estateId);
  const navigate = useNavigate();
  const inspection = useWorkOrderInspection(estateId, sourceInspectionId);
  const inspectionSource = !!sourceInspectionId;
  const locations = useLocations(estateId, false, !inspectionSource);
  const [description, setDescription] = useState("");
  const [selectedLocationId, setLocation] = useState("");
  const [category, setCategory] =
    useState<WorkOrderInput["category"]>("EQUIPMENT_FAULT");
  const [priority, setPriority] =
    useState<WorkOrderInput["priority"]>("MEDIUM");
  const [source, setSource] = useState<WorkOrderInput["source"]>(() => {
    if (sourceInspectionId) {
      return "INSPECTION";
    }
    return sourceReportId ? "RESIDENT_REPORT" : "MANUAL";
  });
  const [reportId, setReportId] = useState(sourceReportId ?? "");
  const [sourceReference, setReference] = useState("");
  const [expectedLocation, setExpectedLocation] = useState<string>();
  const report = useEstateReport(
    estateId,
    source === "RESIDENT_REPORT" ? reportId : ""
  );
  const initialized = useRef<string | undefined>(undefined);
  const [selectedAsset, setAsset] = useState<WorkOrderAssetOption | undefined>(
    undefined
  );
  const asset = inspectionSource ? inspection.asset : selectedAsset;
  const locationId = inspectionSource
    ? (inspection.asset?.locationId ?? "")
    : selectedLocationId;
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
      sourceInspectionId &&
      inspection.record &&
      inspection.asset &&
      initialized.current !== sourceInspectionId
    ) {
      initialized.current = sourceInspectionId;
      setDescription(inspection.record.notes ?? "");
    }
  }, [sourceInspectionId, inspection.record, inspection.asset]);
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
  const sourceChanged = useCallback(
    (next: WorkOrderInput["source"]) => {
      if (inspectionSource) {
        return;
      }
      setSource(next);
      setExpectedLocation(undefined);
      setError(undefined);
      setSourceChoice(undefined);
      if (next !== "RESIDENT_REPORT") {
        setReportId("");
        initialized.current = undefined;
      }
    },
    [inspectionSource]
  );
  const reloadSource = useCallback(async () => {
    setReloading(true);
    try {
      if (inspectionSource) {
        if (await inspection.reload()) {
          setError(undefined);
        }
        return;
      }
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
  }, [inspectionSource, inspection.reload, report.refetch, error]);
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
  const options = locations.isError
    ? []
    : flattenLocations(locations.data ?? []);
  const locationOptions =
    inspectionSource && asset
      ? [{ value: asset.locationId, label: asset.locationPath }]
      : options.map((item) => ({
          value: item.id,
          label: item.path.join(" / "),
        }));
  const inspectionConflict =
    inspectionSource &&
    error instanceof WorkOrderRequestError &&
    error.status === 409;
  const blocked =
    save.isPending ||
    reloading ||
    !!sourceChoice ||
    (inspectionSource
      ? inspection.blocked || inspectionConflict
      : locations.isPending ||
        locations.isError ||
        !options.some((item) => item.id === locationId) ||
        sourceBlocked(
          source,
          access.canReadReports,
          expectedLocation,
          report.isPending,
          report.isError,
          error
        ));
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (saving.current || blocked) {
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
            sourceInspectionId,
            expectedSourceLocationId: inspectionSource
              ? locationId
              : expectedLocation,
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
      blocked,
      category,
      description,
      estateId,
      expectedLocation,
      locationId,
      navigate,
      priority,
      reportId,
      save.mutateAsync,
      source,
      sourceInspectionId,
      inspectionSource,
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
  const reportSource = source === "RESIDENT_REPORT";
  const cancel = useCallback(() => {
    if (inspection.record) {
      return navigate({
        to: "/estates/$estateId/assets/$assetId",
        params: { estateId, assetId: inspection.record.assetId },
      });
    }
  }, [navigate, estateId, inspection.record]);
  return {
    access,
    asset,
    blocked,
    canUseSource,
    category,
    categoryChanged,
    cancel,
    changeAsset,
    changeDescription,
    changeReference,
    description,
    error,
    expectedLocation,
    inspection,
    inspectionSource,
    keepWorkLocation,
    locationId,
    locationOptions,
    locations,
    options,
    priority,
    pending: save.isPending,
    reloadSource,
    report,
    reportId,
    reportSource,
    retryLocations,
    setLocation,
    setPriority,
    setReportId,
    source,
    sourceChanged,
    sourceChoice,
    sourceReference,
    submit,
    useSourceLocation,
  };
}

function workOrderFailure(failure: unknown): Error {
  return failure instanceof Error
    ? failure
    : new Error("Unable to save the work order.");
}

function creationBody(input: WorkOrderInput): WorkOrderInput {
  const {
    sourceReportId,
    sourceInspectionId,
    expectedSourceLocationId,
    sourceReference,
    ...common
  } = input;
  const body = { ...common, description: common.description.trim() };
  if (input.source === "RESIDENT_REPORT") {
    return { ...body, sourceReportId, expectedSourceLocationId };
  }
  if (input.source === "INSPECTION" && sourceInspectionId) {
    return { ...body, sourceInspectionId, expectedSourceLocationId };
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
