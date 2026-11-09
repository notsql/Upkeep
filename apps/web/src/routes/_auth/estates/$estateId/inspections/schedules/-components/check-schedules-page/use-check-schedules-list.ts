import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  type EstateAssetCategory,
  useEstateAssetCategories,
  useSetSilentFailure,
} from "@/lib/asset-categories";
import {
  type ServiceInterval,
  useSetCategoryServiceInterval,
} from "@/lib/service-intervals";
import type { IntervalFilter } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/interval-filter";

function matches(category: EstateAssetCategory, filter: IntervalFilter) {
  if (filter === "ALL") {
    return true;
  }
  if (filter === "NONE") {
    return missing(category);
  }
  return category.serviceInterval?.unit === filter;
}

function missing(category: EstateAssetCategory): boolean {
  return !category.serviceInterval;
}

function byLabel(a: EstateAssetCategory, b: EstateAssetCategory): number {
  return a.label.localeCompare(b.label);
}

export function useCheckSchedulesList(
  estateId: string,
  filter: IntervalFilter
) {
  const categories = useEstateAssetCategories(estateId);
  const setSilentFailure = useSetSilentFailure(estateId);
  const setServiceInterval = useSetCategoryServiceInterval(estateId);
  const [error, setError] = useState<string>();
  const [flagging, setFlagging] = useState<EstateAssetCategory>();
  const [editing, setEditing] = useState<EstateAssetCategory>();
  const { mutateAsync: saveInterval } = setServiceInterval;
  const closeInterval = useCallback(() => setEditing(undefined), []);
  const saveEditing = useCallback(
    async (interval: ServiceInterval | null) => {
      if (!editing) {
        return;
      }
      await saveInterval({ category: editing.code, interval });
      setEditing(undefined);
      toast.success("Saved.");
    },
    [editing, saveInterval]
  );
  const { mutate } = setSilentFailure;
  const openFlag = useCallback((category: EstateAssetCategory) => {
    setError(undefined);
    setFlagging(category);
  }, []);
  const closeFlag = useCallback(() => {
    setError(undefined);
    setFlagging(undefined);
  }, []);
  const confirmFlag = useCallback(() => {
    if (!flagging) {
      return;
    }
    setError(undefined);
    mutate(
      { category: flagging.code, failsSilently: !flagging.failsSilently },
      {
        onSuccess: () => {
          setFlagging(undefined);
          toast.success("Saved.");
        },
        onError: (cause) => setError(cause.message),
      }
    );
  }, [flagging, mutate]);
  const { data } = categories;
  const shown = data?.categories
    .filter((category) => matches(category, filter))
    .sort(byLabel);

  return {
    closeFlag,
    closeInterval,
    confirmFlag,
    data,
    editing,
    error,
    flagging,
    openFlag,
    pending: setSilentFailure.isPending,
    saveEditing,
    setEditing,
    shown,
  };
}
