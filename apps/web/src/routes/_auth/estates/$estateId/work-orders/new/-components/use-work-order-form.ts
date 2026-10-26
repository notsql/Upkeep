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
} from "@/lib/work-orders";

export function useWorkOrderForm(estateId: string, sourceReportId?: string) {
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
  return {
    access,
    asset,
    blocked,
    canUseSource,
    category,
    categoryChanged,
    changeAsset,
    changeDescription,
    changeReference,
    description,
    error,
    expectedLocation,
    keepWorkLocation,
    locationId,
    locations,
    options,
    priority,
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
