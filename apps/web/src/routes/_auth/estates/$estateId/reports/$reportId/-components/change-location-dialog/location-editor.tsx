import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import { FormDialog } from "@/components/dialogs/form-dialog";
import {
  type EstateReport,
  ReportRequestError,
  useRelocateEstateReport,
} from "@/lib/estate-reports";
import type { Location } from "@/lib/locations";

import { LocationSelect } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/change-location-dialog/location-select";

function selection(locationId: string, locations: Location[]) {
  const current = locations.find((location) => location.id === locationId);
  const parent = locations.find(
    (location) => location.id === current?.parentId
  );
  let level = parent?.type === "LEVEL" ? parent : undefined;
  if (current?.type === "LEVEL") {
    level = current;
  }
  return {
    block: level?.parentId ?? (parent?.type === "BLOCK" ? parent.id : null),
    level: level?.id ?? null,
    common:
      current?.type === "COMMON_AREA" && !current.deactivatedAt
        ? current.id
        : null,
  };
}

export function LocationEditor({
  estateId,
  report,
  locations,
  reload,
  close,
}: {
  estateId: string;
  report: EstateReport;
  locations: Location[];
  reload: () => Promise<EstateReport | undefined>;
  close: () => void;
}) {
  const [observed, setObserved] = useState(report);
  const [chosen, setChosen] = useState(() =>
    selection(report.location.id, locations)
  );
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string>();
  const mutation = useRelocateEstateReport(estateId, report.id);
  const active = locations.filter((location) => {
    let node: Location | undefined = location;
    while (node) {
      if (node.deactivatedAt) {
        return false;
      }
      const parentId: string | null | undefined = node.parentId;
      node = parentId
        ? locations.find((parent) => parent.id === parentId)
        : undefined;
    }
    return true;
  });
  const blocks = active.filter((location) => location.type === "BLOCK");
  const levels = active.filter(
    (location) =>
      location.type === "LEVEL" && location.parentId === chosen.block
  );
  const common = active.filter(
    (location) =>
      location.type === "COMMON_AREA" &&
      (location.parentId === chosen.block || location.parentId === chosen.level)
  );
  const destination = active.find(
    (location) => location.id === (chosen.common ?? chosen.level)
  );
  const valid = !!chosen.block && !!destination && destination.type !== "BLOCK";
  const conflict =
    mutation.error instanceof ReportRequestError &&
    mutation.error.status === 409;
  const pending = mutation.isPending || reloading;
  const noDestinations = !active.some((location) => location.type !== "BLOCK");
  const changeBlock = useCallback(
    (value: string | null) =>
      setChosen({ block: value, level: null, common: null }),
    []
  );
  const changeLevel = useCallback(
    (value: string | null) =>
      setChosen((current) => ({
        ...current,
        level: value === "none" ? null : value,
        common: null,
      })),
    []
  );
  const changeCommon = useCallback(
    (value: string | null) =>
      setChosen((current) => ({
        ...current,
        common: value === "none" ? null : value,
      })),
    []
  );
  const save = useCallback(async () => {
    if (!(valid && destination) || pending || conflict) {
      return;
    }
    try {
      await mutation.mutateAsync({
        locationId: destination.id,
        expectedLocationId: observed.location.id,
      });
      close();
    } catch {
      // The mutation's visible error preserves the editor's selected destination.
    }
  }, [
    close,
    conflict,
    destination,
    mutation,
    observed.location.id,
    pending,
    valid,
  ]);
  const reloadCurrent = useCallback(async () => {
    setReloading(true);
    setReloadError(undefined);
    try {
      const current = await reload();
      if (!current) {
        throw new Error("Report unavailable. Try reloading again.");
      }
      setObserved(current);
      setChosen(selection(current.location.id, locations));
      mutation.reset();
    } catch {
      setReloadError("Couldn't reload the current location. Try again.");
    } finally {
      setReloading(false);
    }
  }, [locations, mutation, reload]);
  return (
    <FormDialog
      description="Choose the corrected location within this estate."
      onClose={close}
      onSubmit={save}
      open
      pending={mutation.isPending}
      secondaryActions={
        conflict ? (
          <Button
            disabled={pending}
            onClick={reloadCurrent}
            type="button"
            variant="outline"
          >
            Reload
          </Button>
        ) : null
      }
      submitDisabled={!valid || reloading || conflict}
      submitLabel="Save location"
      title="Change location"
    >
      <p className="wrap-anywhere">
        Current placement: <span>{observed.location.label}</span>
      </p>
      <LocationSelect
        disabled={pending}
        label="Block"
        onChange={changeBlock}
        options={blocks}
        value={chosen.block}
      />
      <LocationSelect
        disabled={pending || !chosen.block}
        label="Level"
        onChange={changeLevel}
        options={[
          { id: "none", name: "No level (block common area)" },
          ...levels,
        ]}
        value={chosen.level ?? "none"}
      />
      <LocationSelect
        disabled={pending || !chosen.block}
        label="Common area"
        onChange={changeCommon}
        options={[
          {
            id: "none",
            name: chosen.level
              ? "None (level only)"
              : "Choose a block common area",
          },
          ...common,
        ]}
        value={chosen.common ?? "none"}
      />
      {chosen.block && !chosen.level && !chosen.common ? (
        <p className="text-muted-foreground text-sm" role="status">
          Choose a common area under this block, or select a level.
        </p>
      ) : null}
      {noDestinations ? (
        <p>There are no locations in use to choose from.</p>
      ) : null}
      {mutation.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            {conflict
              ? "The location changed. Reload the page, then try again."
              : mutation.error.message}
          </AlertDescription>
        </Alert>
      ) : null}
      {reloadError ? <p role="alert">{reloadError}</p> : null}
    </FormDialog>
  );
}
